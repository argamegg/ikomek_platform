import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, LoaderCircle, MessageCircle, Send, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import type { AIAssistantChatMessage, Locale } from "../../types/platform";
import { getErrorMessage, platformApi } from "../services/platformApi";

type AssistantCopy = {
  label: string;
  title: string;
  subtitle: string;
  greeting: string;
  placeholder: string;
  empty: string;
  send: string;
  configured: string;
};

const COPY: Record<Locale, AssistantCopy> = {
  ru: {
    label: "AI ассистент",
    title: "AI ассистент",
    subtitle: "Помогает с заявками, статусами и навигацией",
    greeting: "Здравствуйте! Я помогу разобраться с iKOMEK 109, заявками, новостями и статусами.",
    placeholder: "Напишите вопрос...",
    empty: "Спросите, как создать заявку или где посмотреть статус.",
    send: "Отправить",
    configured: "Gemini API key не настроен",
  },
  kz: {
    label: "AI ассистент",
    title: "AI ассистент",
    subtitle: "Өтінімдер, мәртебелер және навигация бойынша көмектеседі",
    greeting: "Сәлеметсіз бе! Мен iKOMEK 109, өтінімдер, жаңалықтар және мәртебелер бойынша көмектесемін.",
    placeholder: "Сұрағыңызды жазыңыз...",
    empty: "Өтінім жасау немесе мәртебені көру туралы сұраңыз.",
    send: "Жіберу",
    configured: "Gemini API key бапталмаған",
  },
  en: {
    label: "AI assistant",
    title: "AI assistant",
    subtitle: "Helps with requests, statuses, and navigation",
    greeting: "Hi! I can help you use iKOMEK 109, city requests, news, and request statuses.",
    placeholder: "Ask a question...",
    empty: "Ask how to create a request or check a status.",
    send: "Send",
    configured: "Gemini API key is not configured",
  },
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
  const { i18n } = useTranslation();
  const locale = getLocale(i18n.language);
  const copy = COPY[locale];
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [messages, setMessages] = useState<AIAssistantChatMessage[]>([
    { role: "assistant", content: copy.greeting },
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
      return [{ role: "assistant", content: copy.greeting }];
    });
  }, [copy.greeting]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();

    if (!message || isSending) {
      return;
    }

    const nextMessages: AIAssistantChatMessage[] = [...messages, { role: "user", content: message }];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      const response = await platformApi.askAIAssistant({
        message,
        history,
        locale,
      });
      setConfigured(response.configured);
      setMessages((current) => [...current, { role: "assistant", content: response.reply }]);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "Не удалось получить ответ. Проверьте backend и настройки AI.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="ai-assistant">
      {open ? (
        <section className="ai-assistant__panel" aria-label={copy.title}>
          <header className="ai-assistant__header">
            <span className="ai-assistant__avatar">
              <Bot size={20} />
            </span>
            <span>
              <strong>{copy.title}</strong>
              <small>{configured ? copy.subtitle : copy.configured}</small>
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close AI assistant">
              <X size={18} />
            </button>
          </header>
          <div className="ai-assistant__messages" ref={listRef}>
            {messages.length === 0 ? <p className="ai-assistant__empty">{copy.empty}</p> : null}
            {messages.map((message, index) => (
              <article
                className={`ai-assistant__message ai-assistant__message--${message.role}`}
                key={`${message.role}-${index}`}
              >
                {message.content}
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
              placeholder={copy.placeholder}
              maxLength={2000}
            />
            <button type="submit" disabled={sendDisabled} aria-label={copy.send}>
              <Send size={17} />
            </button>
          </form>
        </section>
      ) : null}
      <button
        type="button"
        className="ai-assistant__toggle"
        onClick={() => setOpen((value) => !value)}
        aria-label={copy.label}
        title={copy.label}
      >
        <MessageCircle size={22} />
        <span>AI</span>
      </button>
    </div>
  );
}
