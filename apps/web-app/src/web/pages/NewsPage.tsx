import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { NewsItem } from "../../types/platform";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { formatDate } from "../lib/format";
import { categoryKeyMap, typeKeyMap } from "../lib/normalizers";
import {
  getBorderColor,
  formatNewsRelativeTime,
  getNewsCategory,
  getNewsTypeMeta,
  getNewsTypes,
  NEWS_CATEGORY_OPTIONS,
  NEWS_TYPE_OPTIONS,
  type NewsCategory,
  type NewsType,
} from "../lib/newsMeta";
import { platformApi, queryKeys } from "../services/platformApi";

const ALL_CATEGORIES = "__all__";

function formatNewsPeriod(item: NewsItem, locale: "en" | "ru" | "kz") {
  const start = item.startAt || item.publishedAt;
  if (!start) {
    return "";
  }

  const startDate = new Date(start.endsWith("Z") ? start : `${start}Z`);
  const startLabel = Number.isNaN(startDate.getTime())
    ? ""
    : new Intl.DateTimeFormat(locale === "kz" ? "kk-KZ" : locale === "ru" ? "ru-RU" : "en-US", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(startDate);
  const endDate = item.endAt ? new Date(item.endAt.endsWith("Z") ? item.endAt : `${item.endAt}Z`) : null;
  const endLabel =
    endDate && !Number.isNaN(endDate.getTime())
      ? new Intl.DateTimeFormat(locale === "kz" ? "kk-KZ" : locale === "ru" ? "ru-RU" : "en-US", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }).format(endDate)
      : "";
  return endLabel ? `${startLabel} - ${endLabel}` : startLabel;
}

function getPreviewText(item: NewsItem) {
  return item.summary?.trim() || item.body?.trim() || "";
}

export function NewsPage() {
  const { t, i18n } = useTranslation();
  const [categoryFilter, setCategoryFilter] = useState<typeof ALL_CATEGORIES | NewsCategory>(
    ALL_CATEGORIES,
  );
  const [typeFilters, setTypeFilters] = useState<NewsType[]>([]);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const alertsQuery = useQuery({ queryKey: queryKeys.alerts, queryFn: platformApi.getAlerts });
  const newsQuery = useQuery({ queryKey: queryKeys.news, queryFn: platformApi.getNews });

  const items = useMemo(() => {
    const deduped = [...(alertsQuery.data ?? []), ...(newsQuery.data ?? [])].reduce<NewsItem[]>(
      (accumulator, item) => {
        if (accumulator.some((existing) => existing.id === item.id)) {
          return accumulator;
        }

        accumulator.push(item);
        return accumulator;
      },
      [],
    );

    return deduped
      .filter((item) => {
        const category = getNewsCategory(item);
        if (categoryFilter !== ALL_CATEGORIES && category !== categoryFilter) {
          return false;
        }

        if (typeFilters.length === 0) {
          return true;
        }

        const itemTypes = getNewsTypes(item);
        return typeFilters.some((type) => itemTypes.includes(type));
      })
      .sort((left, right) =>
        String(right.publishedAt || right.startAt || "").localeCompare(
          String(left.publishedAt || left.startAt || ""),
        ),
      );
  }, [alertsQuery.data, categoryFilter, newsQuery.data, typeFilters]);

  const toggleType = (type: NewsType) => {
    setTypeFilters((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  };

  const activeLocale = (i18n.language || "ru") as "en" | "ru" | "kz";

  return (
    <div className="page-stack">
      <PageHeader title={t("news.title")} description={t("news.description")} />

      <div className="news-shell">
        <aside className="news-types-panel">
          <div className="news-types-panel__header">
            <span>Фильтр по типам</span>
            {typeFilters.length > 0 ? (
              <button type="button" className="news-type-reset" onClick={() => setTypeFilters([])}>
                Сбросить
              </button>
            ) : null}
          </div>
          <div className="news-type-list">
            {NEWS_TYPE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = typeFilters.includes(option.label);
              return (
                <button
                  key={option.label}
                  type="button"
                  className={`news-type-filter${active ? " is-active" : ""}`}
                  onClick={() => toggleType(option.label)}
                  >
                    <span
                      className="news-type-filter__icon"
                      style={{ backgroundColor: `${option.color}16`, color: option.color }}
                    >
                      <Icon size={18} />
                    </span>
                  <span className="news-type-filter__label">
                    {t(typeKeyMap[option.label] ?? option.label)}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="news-main">
          <Card className="news-category-toolbar" hover={false}>
            <div className="news-category-pills">
              {([ALL_CATEGORIES, ...NEWS_CATEGORY_OPTIONS] as Array<
                typeof ALL_CATEGORIES | NewsCategory
              >).map((category) => {
                const active = category === categoryFilter;
                return (
                  <button
                    key={category}
                    type="button"
                    className={`news-category-pill${active ? " is-active" : ""}`}
                    onClick={() => setCategoryFilter(category)}
                  >
                    {category === ALL_CATEGORIES
                      ? t("common.all")
                      : t(categoryKeyMap[category] ?? category)}
                  </button>
                );
              })}
            </div>
          </Card>

          <div className="news-grid news-grid--enhanced">
            {items.map((item) => {
              const types = getNewsTypes(item);
              const category = getNewsCategory(item);
              const preview = getPreviewText(item);
              const period = formatNewsPeriod(item, activeLocale);
              const borderColor = getBorderColor(item.startAt, item.endAt);
              const createdAtLabel = formatDate(item.publishedAt || item.startAt, activeLocale);

              return (
                <Card
                  key={item.id}
                  className="news-card news-card--enhanced"
                  onClick={() => setSelectedNews(item)}
                >
                  <div
                    className="news-card__accent"
                    style={{ backgroundColor: borderColor }}
                    aria-hidden="true"
                  />
                  <div className="news-card-types">
                    {types.map((type, index) => {
                      const meta = getNewsTypeMeta(type);
                      const TypeIcon = meta.icon;
                      return (
                        <div key={`${item.id}-${type}-${index}`} className="news-card-type-block">
                          <span
                            className="news-card__type-icon"
                            style={{ backgroundColor: `${meta.color}16`, color: meta.color }}
                          >
                            <TypeIcon size={20} />
                          </span>
                          <div className="news-card-type-meta">
                            <span className="type-name" style={{ color: meta.color }}>
                              {t(typeKeyMap[type] ?? type)}
                            </span>
                            {index === 0 ? <span className="type-date">{createdAtLabel}</span> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <h3>{item.title}</h3>
                  <p>{preview}</p>

                  <div className="news-card__meta-list">
                    {period ? (
                      <span>
                        <Clock3 size={14} />
                        {period}
                      </span>
                    ) : (
                      <span className="news-card__meta-spacer" aria-hidden="true" />
                    )}
                    <span className="news-category-chip">
                      {t(categoryKeyMap[category] ?? category)}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>

          {items.length === 0 ? (
            <Card className="news-empty-state" hover={false}>
              <h3>Ничего не найдено</h3>
              <p>Снимите часть фильтров или выберите другую категорию.</p>
            </Card>
          ) : null}
        </div>
      </div>

      <Modal
        open={Boolean(selectedNews)}
        onClose={() => setSelectedNews(null)}
        title={selectedNews?.title ?? "Новость"}
        description={selectedNews ? formatNewsRelativeTime(selectedNews.publishedAt || selectedNews.startAt, "ru") : ""}
      >
        {selectedNews ? (
          (() => {
            const types = getNewsTypes(selectedNews);
            const category = getNewsCategory(selectedNews);
            const period = formatNewsPeriod(selectedNews, activeLocale);
            const accentColor = getBorderColor(selectedNews.startAt, selectedNews.endAt);

            return (
              <div className="news-detail">
                <div
                  className="news-detail__band"
                  style={{ backgroundColor: accentColor }}
                  aria-hidden="true"
                />
                <div className="news-detail__meta">
                  <span>
                    <Clock3 size={15} />
                    {formatNewsRelativeTime(selectedNews.publishedAt || selectedNews.startAt, "ru")}
                  </span>
                  <span className="news-category-chip">
                    {t(categoryKeyMap[category] ?? category)}
                  </span>
                </div>
                <div className="news-type-chips">
                  {types.map((type) => {
                    const meta = getNewsTypeMeta(type);
                    const Icon = meta.icon;
                    return (
                      <span
                        key={`detail-${selectedNews.id}-${type}`}
                        className="news-type-chip"
                        style={{ backgroundColor: `${meta.color}14`, color: meta.color }}
                      >
                        <Icon size={14} />
                        {t(typeKeyMap[type] ?? type)}
                      </span>
                    );
                  })}
                </div>
                <div className="news-detail__body">
                  <p>{selectedNews.body}</p>
                </div>
                {period || selectedNews.location ? (
                  <div className="news-detail__extras">
                    {period ? (
                      <div className="news-detail__info">
                        <strong>Период</strong>
                        <span>{period}</span>
                      </div>
                    ) : null}
                    {selectedNews.location ? (
                      <div className="news-detail__info">
                        <strong>Локация</strong>
                        <span>{selectedNews.location}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })()
        ) : null}
      </Modal>
    </div>
  );
}
