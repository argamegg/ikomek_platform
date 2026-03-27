import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Paperclip, Send } from "lucide-react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
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
  const requestQuery = useQuery({
    queryKey: queryKeys.request(requestId),
    queryFn: () => platformApi.getRequestById(requestId),
    enabled: Boolean(requestId),
    refetchInterval: 20_000,
  });
  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: platformApi.getCurrentUser,
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [requestQuery.data?.messages.length]);

  const enrichedMessages = useMemo(() => {
    return (requestQuery.data?.messages ?? []).map((item) => ({
      ...item,
      isOwn:
        item.senderName === currentUserQuery.data?.name ||
        item.senderRole === currentUserQuery.data?.primaryRole,
    }));
  }, [currentUserQuery.data?.name, currentUserQuery.data?.primaryRole, requestQuery.data?.messages]);

  const sendMutation = useMutation({
    mutationFn: () => platformApi.postRequestMessage(requestId, { message, attachment }),
    onSuccess: async () => {
      setMessage("");
      setAttachment(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.request(requestId) });
      toast.success("Message sent");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <div className="page-stack">
      <PageHeader title={t("chat.title")} description={t("chat.description")} />
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
                    {item.attachmentLabel || "Attachment"}
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
              label="Message"
              rows={8}
              placeholder={t("chat.placeholder")}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <label className="upload-inline">
              <Paperclip size={16} />
              <span>{attachment?.name ?? "Attach image"}</span>
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
    </div>
  );
}
