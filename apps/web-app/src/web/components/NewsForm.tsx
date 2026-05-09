import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { NewsCreateInput, NewsItem, NewsTranslationPreview } from "../../types/platform";
import { NEWS_CATEGORY_OPTIONS, NEWS_TYPE_OPTIONS } from "../lib/newsMeta";
import { Button } from "./ui/Button";
import { Input, Textarea } from "./ui/Input";

type NewsFormProps = {
  initialValue: NewsCreateInput;
  submitLabel: string;
  isSubmitting?: boolean;
  isTranslating?: boolean;
  onCancel: () => void;
  onTranslate: (value: NewsCreateInput) => Promise<NewsTranslationPreview>;
  onSubmit: (value: NewsCreateInput, options: { skipTranslation?: boolean }) => Promise<void> | void;
};

const TABS = [
  { key: "ru", label: "RU" },
  { key: "kz", label: "KZ" },
  { key: "en", label: "EN" },
] as const;

export function createInitialNewsForm(): NewsCreateInput {
  return {
    title: "",
    category: "Дороги",
    types: ["Дорожные ситуации"],
    summary: "",
    body: "",
    location: "",
    startAt: new Date().toISOString().slice(0, 16),
    endAt: "",
    titleRu: "",
    titleKz: "",
    titleEn: "",
    bodyRu: "",
    bodyKz: "",
    bodyEn: "",
    summaryRu: "",
    summaryKz: "",
    summaryEn: "",
    sourceLang: "ru",
  };
}

export function newsItemToForm(item?: NewsItem | null): NewsCreateInput {
  if (!item) {
    return createInitialNewsForm();
  }

  return {
    title: item.title || "",
    category: item.category,
    types: item.types,
    summary: item.summary || "",
    body: item.body || "",
    location: item.location || "",
    startAt: item.startAt || "",
    endAt: item.endAt || "",
    titleRu: item.titleRu || "",
    titleKz: item.titleKz || "",
    titleEn: item.titleEn || "",
    bodyRu: item.bodyRu || "",
    bodyKz: item.bodyKz || "",
    bodyEn: item.bodyEn || "",
    summaryRu: item.summaryRu || "",
    summaryKz: item.summaryKz || "",
    summaryEn: item.summaryEn || "",
    sourceLang: item.sourceLang === "en" ? "en" : item.sourceLang === "kk" ? "kk" : "ru",
    translationStatus: item.translationStatus,
  };
}

function hasTranslations(value: NewsCreateInput) {
  return Boolean(
    value.titleRu ||
      value.titleKz ||
      value.titleEn ||
      value.bodyRu ||
      value.bodyKz ||
      value.bodyEn,
  );
}

function getFields(tab: (typeof TABS)[number]["key"]) {
  if (tab === "ru") {
    return { title: "titleRu", body: "bodyRu" } as const;
  }

  if (tab === "kz") {
    return { title: "titleKz", body: "bodyKz" } as const;
  }

  return { title: "titleEn", body: "bodyEn" } as const;
}

export function NewsForm({
  initialValue,
  submitLabel,
  isSubmitting = false,
  isTranslating = false,
  onCancel,
  onTranslate,
  onSubmit,
}: NewsFormProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState<NewsCreateInput>(initialValue);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["key"]>("ru");

  useEffect(() => {
    setValue(initialValue);
    setActiveTab(initialValue.titleRu || initialValue.bodyRu ? "ru" : initialValue.titleKz || initialValue.bodyKz ? "kz" : "en");
  }, [initialValue]);

  const translatedVisible = useMemo(() => hasTranslations(value), [value]);
  const localizedFields = getFields(activeTab);

  const updateValue = <K extends keyof NewsCreateInput>(key: K, next: NewsCreateInput[K]) => {
    setValue((current) => ({ ...current, [key]: next }));
  };

  const toggleType = (type: NewsItem["types"][number]) => {
    setValue((current) => {
      const nextTypes = current.types.includes(type)
        ? current.types.filter((item) => item !== type)
        : [...current.types, type];

      return {
        ...current,
        types: nextTypes.length > 0 ? nextTypes : current.types,
      };
    });
  };

  const handleTranslate = async () => {
    const preview = await onTranslate(value);
    setValue((current) => ({
      ...current,
      sourceLang: preview.sourceLang,
      titleRu: preview.translations.ru.title,
      titleKz: preview.translations.kk.title,
      titleEn: preview.translations.en.title,
      bodyRu: preview.translations.ru.content,
      bodyKz: preview.translations.kk.content,
      bodyEn: preview.translations.en.content,
      translationStatus: "translated",
    }));
  };

  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(
          {
            ...value,
            summary: value.summary || value.body.slice(0, 180),
          },
          { skipTranslation: false },
        );
      }}
    >
      <Input
        label={t("admin.news.titleLabel", { defaultValue: "Заголовок новости" })}
        value={value.title}
        onChange={(event) => updateValue("title", event.target.value)}
      />

      <Textarea
        label={t("admin.news.contentLabel", { defaultValue: "Текст новости" })}
        rows={6}
        value={value.body}
        onChange={(event) => updateValue("body", event.target.value)}
      />

      <div className="news-form__actions">
        <Button type="button" variant="secondary" isLoading={isTranslating} onClick={() => void handleTranslate()}>
          {translatedVisible
            ? t("admin.news.retranslate", { defaultValue: "Перевести заново" })
            : t("admin.news.translate", { defaultValue: "Перевести" })}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            void onSubmit(
              {
                ...value,
                summary: value.summary || value.body.slice(0, 180),
                translationStatus: "skipped",
              },
              { skipTranslation: true },
            )
          }
        >
          {t("admin.news.publishWithoutTranslation", { defaultValue: "Опубликовать без перевода" })}
        </Button>
      </div>

      {translatedVisible ? (
        <>
          <div className="news-form__tabs">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`news-form__tab${activeTab === tab.key ? " is-active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <Input
            label={t("admin.news.localizedTitleLabel", {
              lang: activeTab.toUpperCase(),
              defaultValue: `Заголовок ${activeTab.toUpperCase()}`,
            })}
            value={String(value[localizedFields.title] ?? "")}
            onChange={(event) => updateValue(localizedFields.title, event.target.value)}
          />
          <Textarea
            label={t("admin.news.localizedContentLabel", {
              lang: activeTab.toUpperCase(),
              defaultValue: `Текст ${activeTab.toUpperCase()}`,
            })}
            rows={6}
            value={String(value[localizedFields.body] ?? "")}
            onChange={(event) => updateValue(localizedFields.body, event.target.value)}
          />
        </>
      ) : null}

      <Textarea
        label={t("admin.news.summaryLabel", { defaultValue: "Краткое описание" })}
        rows={3}
        value={value.summary}
        onChange={(event) => updateValue("summary", event.target.value)}
      />

      <div className="news-admin-section">
        <label>{t("admin.news.categoryLabel", { defaultValue: "Категория" })}</label>
        <div className="news-admin-categories">
          {NEWS_CATEGORY_OPTIONS.map((category) => (
            <button
              key={category}
              type="button"
              className={`news-category-pill${value.category === category ? " is-active" : ""}`}
              onClick={() => updateValue("category", category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="news-admin-section">
        <label>{t("admin.news.typesLabel", { defaultValue: "Типы" })}</label>
        <div className="news-admin-types">
          {NEWS_TYPE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = value.types.includes(option.label);
            return (
              <button
                key={option.label}
                type="button"
                className={`news-admin-type${active ? " is-active" : ""}`}
                onClick={() => toggleType(option.label)}
                style={{
                  borderColor: active ? option.color : undefined,
                  backgroundColor: active ? `${option.color}10` : undefined,
                }}
              >
                <span
                  className="news-admin-type__icon"
                  style={{ backgroundColor: option.color, color: "#fff" }}
                >
                  <Icon size={18} />
                </span>
                <span className="news-admin-type__body">
                  <strong style={{ color: active ? option.color : undefined }}>{option.label}</strong>
                  <small>{option.defaultCategory}</small>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Input
        label={t("admin.news.locationLabel", { defaultValue: "Локация" })}
        value={value.location}
        onChange={(event) => updateValue("location", event.target.value)}
      />
      <Input
        label={t("admin.news.periodStartLabel", { defaultValue: "Начало периода" })}
        type="datetime-local"
        value={value.startAt}
        onChange={(event) => updateValue("startAt", event.target.value)}
      />
      <Input
        label={t("admin.news.periodEndLabel", { defaultValue: "Окончание периода" })}
        type="datetime-local"
        value={value.endAt ?? ""}
        onChange={(event) => updateValue("endAt", event.target.value)}
      />

      <div className="news-form__footer">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
