import { type FormEvent, useEffect, useState } from "react";
import type { Copy } from "../../App";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { SectionHeading } from "../../components/ui/SectionHeading";
import type { CivicRequest } from "../../types/platform";
import { formatDate, formatRole } from "../../utils/formatters";

type RequestChatSectionProps = {
  copy: Copy;
  requestId: string;
  loadRequest: (requestId: string) => Promise<CivicRequest>;
  onSend: (requestId: string, payload: { message: string; attachment?: File | null }) => Promise<unknown>;
};

export function RequestChatSection({
  copy,
  requestId,
  loadRequest,
  onSend,
}: RequestChatSectionProps) {
  const [request, setRequest] = useState<CivicRequest | null>(null);
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    void loadRequest(requestId).then((value) => {
      if (isMounted) {
        setRequest(value);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [requestId, loadRequest]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    try {
      await onSend(requestId, { message, attachment });
      setMessage("");
      setAttachment(null);
      const refreshed = await loadRequest(requestId);
      setRequest(refreshed);
      setStatus("Message sent.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to send message.");
    }
  }

  if (!request) {
    return <section className="section"><p>Loading request chat...</p></section>;
  }

  return (
    <section className="section">
      <SectionHeading
        kicker={copy.chat.kicker}
        title={copy.chat.title}
        description={copy.chat.description}
      />
      <div className="cards-grid cards-grid--two">
        <Card>
          <div className="chat-thread">
            {request.messages.map((item) => (
              <div key={item.id} className="chat-message">
                <strong>
                  {item.senderName} • {formatRole(item.senderRole)}
                </strong>
                <p>{item.message}</p>
                <span>{formatDate(item.timestamp)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <form className="form-grid" onSubmit={handleSubmit}>
            <label className="form-field">
              <span>Message</span>
              <textarea
                className="text-input text-input--area"
                rows={6}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                required
              />
            </label>
            <label className="form-field">
              <span>Attachment</span>
              <input
                className="text-input"
                type="file"
                accept="image/*"
                onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
              />
            </label>
            <Button label="Send message" type="submit" />
            {status ? <p className="form-status">{status}</p> : null}
          </form>
        </Card>
      </div>
    </section>
  );
}
