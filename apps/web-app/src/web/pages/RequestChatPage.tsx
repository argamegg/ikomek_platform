import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowLeft, ImageIcon, Paperclip, Send, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { formatDate, getStatusTone } from "../lib/format";
import { localizeRequestProblemType, localizeRequestStatus } from "../lib/requestMeta";
import { getErrorMessage, platformApi, queryKeys } from "../services/platformApi";
import type { RequestMessage } from "../../types/platform";

function mergeMessages(current: RequestMessage[] | undefined, incoming: RequestMessage) {
  const messages = current ?? [];
  if (messages.some((message) => message.id === incoming.id)) {
    return messages;
  }

  return [...messages, incoming].sort(
    (first, second) => new Date(first.timestamp).getTime() - new Date(second.timestamp).getTime(),
  );
}

function ChatImagePreview({ src, label }: { src: string; label: string }) {
  return (
    <a className="chat-message__image" href={src} target="_blank" rel="noreferrer">
      <img src={src} alt={label} />
    </a>
  );
}

export function RequestChatPage() {
  const { requestId = "" } = useParams();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isSocketLive, setIsSocketLive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: platformApi.getCurrentUser,
  });
  const currentUser = currentUserQuery.data ?? null;
  const requestQueryKey = useMemo(
    () => [...queryKeys.request(requestId), i18n.language, currentUser?.id ?? "guest"],
    [currentUser?.id, i18n.language, requestId],
  );
  const messagesQueryKey = useMemo(() => queryKeys.requestMessages(requestId), [requestId]);

  const requestQuery = useQuery({
    queryKey: requestQueryKey,
    queryFn: () => platformApi.getRequestById(requestId),
    enabled: Boolean(requestId) && Boolean(currentUser),
    refetchInterval: currentUser ? 30_000 : false,
  });
  const request = requestQuery.data;
  const canUseChat = Boolean(
    request &&
      currentUser &&
      (
        currentUser.roles.some((role) => role === "operator" || role === "admin") ||
        currentUser.id === request.citizenId
      ),
  );
  const messagesQuery = useQuery({
    queryKey: messagesQueryKey,
    queryFn: () => platformApi.getRequestMessages(requestId),
    enabled: Boolean(requestId) && canUseChat,
    refetchInterval: isSocketLive ? false : 4_000,
  });

  const attachmentPreviewUrl = useMemo(() => {
    if (!attachment) return null;
    return URL.createObjectURL(attachment);
  }, [attachment]);

  useEffect(() => {
    return () => {
      if (attachmentPreviewUrl) {
        URL.revokeObjectURL(attachmentPreviewUrl);
      }
    };
  }, [attachmentPreviewUrl]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messagesQuery.data?.length]);

  useEffect(() => {
    if (!requestId || !canUseChat) return undefined;

    const socketUrl = platformApi.getRequestMessagesSocketUrl(requestId);
    if (!socketUrl) return undefined;

    const socket = new WebSocket(socketUrl);
    socket.onopen = () => setIsSocketLive(true);
    socket.onclose = () => setIsSocketLive(false);
    socket.onerror = () => setIsSocketLive(false);
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string; message?: unknown };
        if (payload.type !== "message" || !payload.message) {
          return;
        }

        const incoming = platformApi.normalizeIncomingMessage(payload.message);
        queryClient.setQueryData<RequestMessage[]>(messagesQueryKey, (current) => mergeMessages(current, incoming));
        queryClient.setQueryData(requestQueryKey, (currentRequest: typeof request | undefined) => {
          if (!currentRequest) return currentRequest;
          return {
            ...currentRequest,
            messages: mergeMessages(currentRequest.messages, incoming),
          };
        });
      } catch (error) {
        console.warn("Unable to parse chat socket event", error);
      }
    };

    return () => {
      socket.close();
      setIsSocketLive(false);
    };
  }, [canUseChat, messagesQueryKey, queryClient, requestId, requestQueryKey]);

  const enrichedMessages = useMemo(() => {
    return (messagesQuery.data ?? []).map((item) => ({
      ...item,
      isOwn: Boolean(currentUser && item.senderId === currentUser.id),
    }));
  }, [currentUser, messagesQuery.data]);

  const sendMutation = useMutation({
    mutationFn: () => platformApi.postRequestMessage(requestId, { message: message.trim(), attachment }),
    onSuccess: (sentMessage) => {
      setMessage("");
      setAttachment(null);
      queryClient.setQueryData<RequestMessage[]>(messagesQueryKey, (current) => mergeMessages(current, sentMessage));
      queryClient.invalidateQueries({ queryKey: queryKeys.request(requestId) });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const handleSubmit = () => {
    if ((!message.trim() && !attachment) || sendMutation.isPending) {
      return;
    }
    sendMutation.mutate();
  };

  const statusTone = request ? getStatusTone(request.status) : "neutral";
  const isCheckingAccess = currentUserQuery.isLoading || requestQuery.isLoading;
  const requestTitle = request
    ? localizeRequestProblemType(request.categoryId || request.categoryName, request.title, t)
    : "";
  const requestStatusLabel = request ? localizeRequestStatus(request.statusLabel || request.status, t) : "";
  const requestInitial = (requestTitle || t("common.requests")).slice(0, 1).toUpperCase();

  return (
    <div className="chat-page">
      {isCheckingAccess ? null : canUseChat && request ? (
        <section className="chat-shell">
          <header className="chat-shell__header">
            <div className="chat-shell__identity">
              <Link className="chat-shell__back" to={`/requests/${request.id}`}>
                <ArrowLeft size={18} />
              </Link>
              <div className="chat-shell__avatar">
                {requestInitial}
              </div>
              <div>
                <p>{t("chat.requestLabel")} #{request.id.slice(0, 8)}</p>
                <h1>{requestTitle}</h1>
                <span>{request.address}</span>
              </div>
            </div>
            <div className="chat-shell__status">
              <span className={`badge badge--${statusTone}`}>{requestStatusLabel}</span>
              <small className={isSocketLive ? "chat-live chat-live--on" : "chat-live"}>
                {isSocketLive ? t("chat.live") : t("chat.reconnecting")}
              </small>
            </div>
          </header>

          <div className="chat-thread chat-thread--social">
            {messagesQuery.isLoading ? (
              <div className="chat-empty">{t("common.loading")}</div>
            ) : enrichedMessages.length ? (
              enrichedMessages.map((item) => (
                <article
                  key={item.id}
                  className={`chat-message ${item.isOwn ? "chat-message--own" : ""}`}
                >
                  {!item.isOwn ? <div className="chat-message__avatar">{item.senderName.slice(0, 1).toUpperCase()}</div> : null}
                  <div className="chat-message__body">
                    <div className="chat-message__bubble">
                      <div className="chat-message__meta">
                        <strong>{item.senderName}</strong>
                        <span>{formatDate(item.timestamp, i18n.language as "en" | "ru" | "kz")}</span>
                      </div>
                      {item.message ? <p>{item.message}</p> : null}
                      {item.attachmentUrl ? (
                        item.attachmentType === "image" || item.attachmentUrl.startsWith("data:image") ? (
                          <ChatImagePreview src={item.attachmentUrl} label={item.attachmentLabel || t("chat.attachment")} />
                        ) : (
                          <a className="chat-message__file" href={item.attachmentUrl} target="_blank" rel="noreferrer">
                            <Paperclip size={15} />
                            {item.attachmentLabel || t("chat.attachment")}
                          </a>
                        )
                      ) : null}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="chat-empty">
                <ImageIcon size={28} />
                <strong>{t("chat.emptyTitle")}</strong>
                <span>{t("chat.emptyDescription")}</span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {attachment ? (
            <div className="chat-composer__attachment">
              {attachmentPreviewUrl ? <img src={attachmentPreviewUrl} alt={attachment.name} /> : <Paperclip size={18} />}
              <span>{attachment.name}</span>
              <button type="button" onClick={() => setAttachment(null)} aria-label={t("common.delete")}>
                <X size={16} />
              </button>
            </div>
          ) : null}

          <footer className="chat-composer">
            <button
              type="button"
              className="chat-composer__media"
              onClick={() => fileInputRef.current?.click()}
              aria-label={t("chat.attachMedia")}
            >
              <Paperclip size={19} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
            />
            <textarea
              rows={1}
              placeholder={t("chat.placeholder")}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <Button
              type="button"
              isLoading={sendMutation.isPending}
              onClick={handleSubmit}
              disabled={!message.trim() && !attachment}
              iconRight={<Send size={16} />}
            >
              {t("common.send")}
            </Button>
          </footer>
        </section>
      ) : (
        <EmptyState title={t("chat.unavailableTitle")} description={t("chat.unavailableDescription")} />
      )}
    </div>
  );
}
