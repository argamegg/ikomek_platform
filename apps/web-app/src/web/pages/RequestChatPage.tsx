import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Paperclip, Send } from "lucide-react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Textarea } from "../components/ui/Input";
import { formatDate } from "../lib/format";
import { getErrorMessage, platformApi, queryKeys } from "../services/platformApi";

export function RequestChatPage() {
  const { requestId = "" } = useParams();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: platformApi.getCurrentUser,
  });
  const currentUser = currentUserQuery.data ?? null;
  const requestQueryKey = [...queryKeys.request(requestId), i18n.language, currentUser?.id ?? "guest"];
  const requestQuery = useQuery({
    queryKey: requestQueryKey,
    queryFn: () => platformApi.getRequestById(requestId),
    enabled: Boolean(requestId) && Boolean(currentUser),
    refetchInterval: currentUser ? 20_000 : false,
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
  const isCheckingAccess = requestQuery.isLoading || currentUserQuery.isLoading;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [requestQuery.data?.messages.length]);

  const enrichedMessages = useMemo(() => {
    return (request?.messages ?? []).map((item) => ({
      ...item,
      isOwn:
        item.senderName === currentUserQuery.data?.name ||
        item.senderRole === currentUserQuery.data?.primaryRole,
    }));
  }, [currentUserQuery.data?.name, currentUserQuery.data?.primaryRole, request?.messages]);

  const sendMutation = useMutation({
    mutationFn: () => platformApi.postRequestMessage(requestId, { message, attachment }),
    onSuccess: async () => {
      setMessage("");
      setAttachment(null);
      await queryClient.invalidateQueries({ queryKey: requestQueryKey });
      toast.success(t("chat.sent"));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <div className="page-stack">
      <PageHeader title={t("chat.title")} description={t("chat.description")} />
      {isCheckingAccess ? null : canUseChat ? (
        <div className="dashboard-grid dashboard-grid--wide">
          <Card className="section-card chat-thread-card" hover={false}>
            <div className="chat-thread">
              {enrichedMessages.map((item) => (
                <div key={item.id} className={`chat-bubble ${item.isOwn ? "chat-bubble--own" : ""}`}>
                  <div className="chat-bubble__meta">
                    <strong>{item.senderName}</strong>
                    <span>{formatDate(item.timestamp, i18n.language as "en" | "ru" | "kz")}</span>
                  </div>
                  <p>{item.message}</p>
                  {item.attachmentUrl ? (
                    <a href={item.attachmentUrl} target="_blank" rel="noreferrer">
                      {item.attachmentLabel || t("common.attachment")}
                    </a>
                  ) : null}
                </div>
              ))}
              <div ref={endRef} />
            </div>
          </Card>

          <Card className="section-card" hover={false}>
            <form
              className="form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                sendMutation.mutate();
              }}
            >
              <Textarea
                label={t("chat.message")}
                rows={8}
                placeholder={t("chat.placeholder")}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
              <label className="upload-inline">
                <Paperclip size={16} />
                <span>{attachment?.name ?? t("common.attachImage")}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                />
              </label>
              <Button type="submit" isLoading={sendMutation.isPending} iconRight={<Send size={16} />}>
                {t("common.send")}
              </Button>
            </form>
          </Card>
        </div>
      ) : (
        <EmptyState title={t("chat.unavailableTitle")} description={t("chat.unavailableDescription")} />
      )}
    </div>
  );
}
