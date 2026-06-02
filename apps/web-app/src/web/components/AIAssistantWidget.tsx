import { type CSSProperties, type FormEvent, type PointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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

type AssistantPanelSize = {
  width: number;
  height: number;
};

const ASSISTANT_PANEL_SIZE_KEY = "ikomek.aiAssistant.panelSize";
const DEFAULT_PANEL_SIZE: AssistantPanelSize = { width: 360, height: 520 };
const MIN_PANEL_SIZE: AssistantPanelSize = { width: 360, height: 520 };
const MAX_PANEL_SIZE: AssistantPanelSize = { width: 760, height: 820 };

function getLocale(language: string): Locale {
  if (language.startsWith("kz") || language.startsWith("kk")) {
    return "kz";
  }
  if (language.startsWith("en")) {
    return "en";
  }
  return "ru";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function loadPanelSize(): AssistantPanelSize {
  if (typeof window === "undefined") {
    return DEFAULT_PANEL_SIZE;
  }

  try {
    const rawValue = window.localStorage.getItem(ASSISTANT_PANEL_SIZE_KEY);
    if (!rawValue) {
      return DEFAULT_PANEL_SIZE;
    }

    const parsed = JSON.parse(rawValue) as Partial<AssistantPanelSize>;
    return {
      width: clamp(Number(parsed.width) || DEFAULT_PANEL_SIZE.width, MIN_PANEL_SIZE.width, MAX_PANEL_SIZE.width),
      height: clamp(Number(parsed.height) || DEFAULT_PANEL_SIZE.height, MIN_PANEL_SIZE.height, MAX_PANEL_SIZE.height),
    };
  } catch {
    return DEFAULT_PANEL_SIZE;
  }
}

function savePanelSize(size: AssistantPanelSize) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ASSISTANT_PANEL_SIZE_KEY, JSON.stringify(size));
}

function renderAssistantContent(content: string): ReactNode {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(content.slice(lastIndex, match.index));
    }

    nodes.push(
      <strong key={`strong-${match.index}`}>
        {match[2] ?? match[3]}
      </strong>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    nodes.push(content.slice(lastIndex));
  }

  return nodes.length ? nodes : content;
}

export function AIAssistantWidget() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = getLocale(i18n.language);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [panelSize, setPanelSize] = useState<AssistantPanelSize>(() => loadPanelSize());
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

  function handleResizeStart(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startSize = panelSize;

    function handlePointerMove(moveEvent: globalThis.PointerEvent) {
      const nextSize = {
        width: clamp(startSize.width + startX - moveEvent.clientX, MIN_PANEL_SIZE.width, MAX_PANEL_SIZE.width),
        height: clamp(startSize.height + startY - moveEvent.clientY, MIN_PANEL_SIZE.height, MAX_PANEL_SIZE.height),
      };
      setPanelSize(nextSize);
      savePanelSize(nextSize);
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  const textScale = clamp(panelSize.width / DEFAULT_PANEL_SIZE.width, 1, 1.3);
  const panelStyle: CSSProperties &
    Record<
      | "--ai-assistant-width"
      | "--ai-assistant-height"
      | "--ai-assistant-message-font-size"
      | "--ai-assistant-input-font-size"
      | "--ai-assistant-title-font-size"
      | "--ai-assistant-subtitle-font-size",
      string
    > = {
    "--ai-assistant-width": `${panelSize.width}px`,
    "--ai-assistant-height": `${panelSize.height}px`,
    "--ai-assistant-message-font-size": `${15.5 * textScale}px`,
    "--ai-assistant-input-font-size": `${15 * textScale}px`,
    "--ai-assistant-title-font-size": `${17 * textScale}px`,
    "--ai-assistant-subtitle-font-size": `${12.5 * textScale}px`,
    transformOrigin: "bottom right",
  };

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
            style={panelStyle}
          >
          <button
            type="button"
            className="ai-assistant__resize"
            onPointerDown={handleResizeStart}
            aria-label={t("aiAssistant.resize", { defaultValue: "Resize AI assistant" })}
            title={t("aiAssistant.resize", { defaultValue: "Resize AI assistant" })}
          />
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
                {renderAssistantContent(message.content)}
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
