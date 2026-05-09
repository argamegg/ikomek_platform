import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import type { NewsItem } from "../../types/platform";
import { Card } from "../components/ui/Card";
import { Input, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { categoryKeyMap, formatNewsDate, formatNewsPeriod, typeKeyMap } from "../lib/normalizers";
import {
  getBorderColor,
  getNewsCategory,
  getNewsTypeMeta,
  getNewsTypes,
  NEWS_CATEGORY_OPTIONS,
  NEWS_TYPE_OPTIONS,
} from "../lib/newsMeta";
import { platformApi, queryKeys } from "../services/platformApi";
import { Button } from "../components/ui/Button";

const LIMIT = 20;

function getPreviewText(item: NewsItem) {
  return item.summary?.trim() || item.body?.trim() || "";
}

function formatNewsPeriodRange(item: NewsItem) {
  const start = item.startAt || item.publishedAt;
  if (!start) {
    return "";
  }

  const startLabel = formatNewsPeriod(start);
  const endLabel = item.endAt ? formatNewsPeriod(item.endAt) : "";
  return endLabel ? `${startLabel} - ${endLabel}` : startLabel;
}

function formatNewsCreatedLabel(
  value: string,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (!value) {
    return t("news.createdJustNow");
  }

  const normalized = value.endsWith("Z") ? value : `${value}Z`;
  const timestamp = new Date(normalized).getTime();
  if (Number.isNaN(timestamp)) {
    return t("news.createdJustNow");
  }

  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (diffMinutes < 60) {
    return t("news.createdJustNow");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return t("news.createdHoursAgo", { count: diffHours });
  }

  const diffDays = Math.round(diffHours / 24);
  return t("news.createdAgo", { count: diffDays });
}

export function NewsPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");

  const category = searchParams.get("category") ?? "";
  const type = searchParams.get("type") ?? "";
  const period = searchParams.get("period") ?? "all";
  const sort = searchParams.get("sort") ?? "date_desc";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const search = searchParams.get("search") ?? "";

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "all") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });
    setSearchParams(next);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchInput !== search) {
        updateParams({ search: searchInput || null, page: "1" });
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [search, searchInput, searchParams]);

  const newsQuery = useQuery({
    queryKey: [...queryKeys.news, i18n.language, { search, category, type, period, sort, page }],
    queryFn: () =>
      platformApi.getNews({
        search: search || undefined,
        category: category || undefined,
        type: type || undefined,
        period: period === "all" ? undefined : period,
        sort,
        page,
        limit: LIMIT,
      }),
  });

  const items = newsQuery.data?.news ?? [];
  const pageCount = Math.max(1, Math.ceil((newsQuery.data?.total ?? 0) / LIMIT));

  return (
    <div className="page-stack">
      <PageHeader title={t("news.title")} description={t("news.description")} />

      <Card hover={false} className="news-toolbar">
        <div className="news-toolbar__grid">
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t("news.searchPlaceholder", { defaultValue: "Поиск..." })}
          />
          <Select value={category || "all"} onChange={(event) => updateParams({ category: event.target.value, page: "1" })}>
            <option value="all">{t("news.allCategories", { defaultValue: "Все категории" })}</option>
            {NEWS_CATEGORY_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {t(categoryKeyMap[item] ?? item)}
              </option>
            ))}
          </Select>
          <Select value={type || "all"} onChange={(event) => updateParams({ type: event.target.value, page: "1" })}>
            <option value="all">{t("news.allTypes", { defaultValue: "Все типы" })}</option>
            {NEWS_TYPE_OPTIONS.map((item) => (
              <option key={item.label} value={item.label}>
                {t(typeKeyMap[item.label] ?? item.label)}
              </option>
            ))}
          </Select>
          <Select value={period} onChange={(event) => updateParams({ period: event.target.value, page: "1" })}>
            <option value="all">{t("news.periodAll", { defaultValue: "Все периоды" })}</option>
            <option value="active">{t("news.periodActive", { defaultValue: "Активные" })}</option>
            <option value="finished">{t("news.periodFinished", { defaultValue: "Завершённые" })}</option>
            <option value="no_period">{t("news.periodNoPeriod", { defaultValue: "Без периода" })}</option>
          </Select>
          <Select value={sort} onChange={(event) => updateParams({ sort: event.target.value, page: "1" })}>
            <option value="date_desc">{t("news.sortNewest", { defaultValue: "Сначала новые" })}</option>
            <option value="date_asc">{t("news.sortOldest", { defaultValue: "Сначала старые" })}</option>
          </Select>
        </div>
      </Card>

      <div className="news-grid news-grid--enhanced">
        {items.map((item) => {
          const types = getNewsTypes(item);
          const categoryValue = getNewsCategory(item);
          const preview = getPreviewText(item);
          const periodLabel = formatNewsPeriodRange(item);
          const borderColor = getBorderColor(item.startAt, item.endAt);
          const createdAtLabel = formatNewsDate(item.publishedAt || item.startAt || "");

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
                {types.map((newsType, index) => {
                  const meta = getNewsTypeMeta(newsType);
                  const TypeIcon = meta.icon;
                  return (
                    <div key={`${item.id}-${newsType}-${index}`} className="news-card-type-block">
                      <span
                        className="news-card__type-icon"
                        style={{ backgroundColor: `${meta.color}16`, color: meta.color }}
                      >
                        <TypeIcon size={20} />
                      </span>
                      <div className="news-card-type-meta">
                        <span className="type-name" style={{ color: meta.color }}>
                          {t(typeKeyMap[newsType] ?? newsType)}
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
                {periodLabel ? (
                  <span>
                    <Clock3 size={14} />
                    {periodLabel}
                  </span>
                ) : (
                  <span className="news-card__meta-spacer" aria-hidden="true" />
                )}
                <span className="news-category-chip">
                  {t(categoryKeyMap[categoryValue] ?? categoryValue)}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {!newsQuery.isLoading && items.length === 0 ? (
        <Card className="news-empty-state" hover={false}>
          <h3>{t("news.noResults", { defaultValue: "Ничего не найдено" })}</h3>
          <p>{t("news.emptyFiltered", { defaultValue: "Снимите часть фильтров или измените поисковый запрос." })}</p>
        </Card>
      ) : null}

      <div className="news-pagination">
        <Button
          type="button"
          variant="ghost"
          disabled={page <= 1}
          onClick={() => updateParams({ page: String(Math.max(1, page - 1)) })}
        >
          {t("common.back")}
        </Button>
        <span>{page} / {pageCount}</span>
        <Button
          type="button"
          variant="ghost"
          disabled={page >= pageCount}
          onClick={() => updateParams({ page: String(Math.min(pageCount, page + 1)) })}
        >
          {t("common.continue")}
        </Button>
      </div>

      <Modal
        open={Boolean(selectedNews)}
        onClose={() => setSelectedNews(null)}
        title={selectedNews?.title ?? "Новость"}
      >
        {selectedNews ? (
          (() => {
            const types = getNewsTypes(selectedNews);
            const categoryValue = getNewsCategory(selectedNews);
            const periodValue = formatNewsPeriodRange(selectedNews);
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
                    {formatNewsCreatedLabel(selectedNews.publishedAt || selectedNews.startAt || "", t)}
                  </span>
                  <span className="news-category-chip">
                    {t(categoryKeyMap[categoryValue] ?? categoryValue)}
                  </span>
                </div>
                <div className="news-type-chips">
                  {types.map((newsType) => {
                    const meta = getNewsTypeMeta(newsType);
                    const Icon = meta.icon;
                    return (
                      <span
                        key={`detail-${selectedNews.id}-${newsType}`}
                        className="news-type-chip"
                        style={{ backgroundColor: `${meta.color}14`, color: meta.color }}
                      >
                        <Icon size={14} />
                        {t(typeKeyMap[newsType] ?? newsType)}
                      </span>
                    );
                  })}
                </div>
                <div className="news-detail__body">
                  <p>{selectedNews.body}</p>
                </div>
                {periodValue || selectedNews.location ? (
                  <div className="news-detail__extras">
                    {periodValue ? (
                      <div className="news-detail__info">
                        <strong>{t("news.period")}</strong>
                        <span>{periodValue}</span>
                      </div>
                    ) : null}
                    {selectedNews.location ? (
                      <div className="news-detail__info">
                        <strong>{t("news.location")}</strong>
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
