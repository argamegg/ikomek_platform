import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, MessageCircle, Send, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import type { AIAssistantAction, AIAssistantChatMessage, Locale } from "../../types/platform";
import { getErrorMessage, platformApi } from "../services/platformApi";

type AssistantMessage = AIAssistantChatMessage & {
  actions?: AIAssistantAction[];
};

function getLocale(language: string): Locale {
  if (language.startsWith("kz") || language.startsWith("kk")) {
    return "kz";
  }
  if (language.startsWith("en")) {
    return "en";
  }
  return "ru";
}

export function AIAssistantWidget() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = getLocale(i18n.language);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    { role: "assistant", content: t("aiAssistant.greeting") },
  ]);
  const listRef = useRef<HTMLDivElement | null>(null);

  const sendDisabled = isSending || input.trim().length === 0;
  const history = useMemo(() => messages.slice(-8), [messages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    setMessages((current) => {
      if (current.length !== 1 || current[0].role !== "assistant") {
        return current;
      }
      return [{ role: "assistant", content: t("aiAssistant.greeting") }];
    });
  }, [t, i18n.language]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();

    if (!message || isSending) {
      return;
    }

    const nextMessages: AssistantMessage[] = [...messages, { role: "user", content: message }];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      const response = await platformApi.askAIAssistant({
        message,
        history: history.map((item) => ({ role: item.role, content: item.content })),
        locale,
      });
      setConfigured(response.configured);
      setMessages((current) => [
        ...current,
        { role: "assistant", content: response.reply, actions: response.actions },
      ]);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: t("aiAssistant.failed"),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function handleAction(action: AIAssistantAction) {
    if (!action.web_path) {
      return;
    }
    navigate(action.web_path);
    setOpen(false);
  }

  return (
    <div className="ai-assistant">
      <AnimatePresence>
        {open ? (
          <motion.section
            className="ai-assistant__panel"
            aria-label={t("aiAssistant.title")}
            initial={{ opacity: 0, scale: 0.85, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 16 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "bottom right" }}
          >
          <header className="ai-assistant__header">
            <span className="ai-assistant__avatar">
              <MessageCircle size={20} />
            </span>
            <span>
              <strong>{t("aiAssistant.title")}</strong>
              <small>{configured ? t("aiAssistant.subtitle") : t("aiAssistant.configured")}</small>
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label={t("aiAssistant.close")}>
              <X size={18} />
            </button>
          </header>
          <div className="ai-assistant__messages" ref={listRef}>
            {messages.length === 0 ? <p className="ai-assistant__empty">{t("aiAssistant.empty")}</p> : null}
            {messages.map((message, index) => (
              <article
                className={`ai-assistant__message ai-assistant__message--${message.role}`}
                key={`${message.role}-${index}`}
              >
                {message.content}
                {message.actions?.length ? (
                  <div className="ai-assistant__actions">
                    {message.actions.map((action, actionIndex) => (
                      <button
                        type="button"
                        key={`${action.label}-${actionIndex}`}
                        onClick={() => handleAction(action)}
                        disabled={!action.web_path}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
            {isSending ? (
              <article className="ai-assistant__message ai-assistant__message--assistant ai-assistant__message--loading">
                <LoaderCircle size={16} />
              </article>
            ) : null}
          </div>
          <form className="ai-assistant__form" onSubmit={handleSubmit}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t("aiAssistant.placeholder")}
              maxLength={2000}
            />
            <button type="submit" disabled={sendDisabled} aria-label={t("common.send")}>
              <Send size={17} />
            </button>
          </form>
          </motion.section>
        ) : null}
      </AnimatePresence>
      <button
        type="button"
        className={`ai-assistant__toggle${open ? " ai-assistant__toggle--open" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-label={t("aiAssistant.label")}
        title={t("aiAssistant.label")}
      >
        <MessageCircle className="ai-assistant__toggle-icon ai-assistant__toggle-icon--message" size={24} />
        <X className="ai-assistant__toggle-icon ai-assistant__toggle-icon--close" size={24} />
      </button>
    </div>
  );
}
