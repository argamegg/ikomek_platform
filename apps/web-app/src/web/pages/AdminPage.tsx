import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import type { NewsCreateInput, NewsItem } from "../../types/platform";
import { NewsForm, createInitialNewsForm, newsItemToForm } from "../components/NewsForm";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { categoryKeyMap, formatNewsDate, typeKeyMap } from "../lib/normalizers";
import { localizeRequestCategory } from "../lib/requestMeta";
import { getErrorMessage, platformApi, queryKeys } from "../services/platformApi";
import {
  getBorderColor,
  getNewsCategory,
  getNewsTypeMeta,
  getNewsTypes,
  NEWS_CATEGORY_OPTIONS,
  NEWS_TYPE_OPTIONS,
} from "../lib/newsMeta";

const LIMIT = 20;

function getTranslationStatusMeta(status?: string) {
  if (status === "translated") {
    return { icon: "✅", key: "translated", className: "news-status-pill--translated" };
  }

  if (status === "failed") {
    return { icon: "⚠️", key: "failed", className: "news-status-pill--failed" };
  }

  if (status === "skipped") {
    return { icon: "⊘", key: "skipped", className: "news-status-pill--skipped" };
  }

  return null;
}

export function AdminPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNews, setEditingNews] = useState<NewsItem | null>(null);
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

  const metricsQuery = useQuery({ queryKey: queryKeys.metrics, queryFn: platformApi.getMetrics });
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

  const previewItems = newsQuery.data?.news ?? [];
  const pageCount = Math.max(1, Math.ceil((newsQuery.data?.total ?? 0) / LIMIT));
  const formInitialValue = useMemo(
    () => (editingNews ? newsItemToForm(editingNews) : createInitialNewsForm()),
    [editingNews],
  );

  const createNewsMutation = useMutation({
    mutationFn: (payload: NewsCreateInput) => platformApi.createNews(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.news }),
        queryClient.invalidateQueries({ queryKey: queryKeys.alerts }),
      ]);
      toast.success(t("admin.news.created"));
      setModalOpen(false);
      setEditingNews(null);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const updateNewsMutation = useMutation({
    mutationFn: ({ newsId, payload }: { newsId: string; payload: NewsCreateInput }) =>
      platformApi.updateNews(newsId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.news }),
        queryClient.invalidateQueries({ queryKey: queryKeys.alerts }),
      ]);
      toast.success(t("admin.news.updated"));
      setModalOpen(false);
      setEditingNews(null);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteNewsMutation = useMutation({
    mutationFn: (newsId: string) => platformApi.deleteNews(newsId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.news }),
        queryClient.invalidateQueries({ queryKey: queryKeys.alerts }),
      ]);
      toast.success(t("admin.news.deleted"));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const previewTranslationMutation = useMutation({
    mutationFn: ({ title, content }: { title: string; content: string }) =>
      platformApi.previewNewsTranslation({ title, content }),
  });

  const handleSubmit = async (value: NewsCreateInput, options: { skipTranslation?: boolean }) => {
    if (!value.title.trim() || !value.body.trim()) {
      toast.error(t("admin.news.fillTitleAndText"));
      return;
    }

    if (value.types.length === 0) {
      toast.error(t("admin.news.selectOneType"));
      return;
    }

    const payload: NewsCreateInput = {
      ...value,
      summary: value.summary || value.body.slice(0, 180),
      translationStatus: options.skipTranslation ? "skipped" : value.translationStatus,
      skipTranslation: options.skipTranslation,
    };

    if (editingNews) {
      await updateNewsMutation.mutateAsync({ newsId: editingNews.id, payload });
      return;
    }

    await createNewsMutation.mutateAsync(payload);
  };

  return (
    <div className="page-stack">
      <PageHeader
        title={t("admin.title")}
        description={t("admin.description")}
        action={
          <Button
            onClick={() => {
              setEditingNews(null);
              setModalOpen(true);
            }}
          >
            {t("admin.publish")}
          </Button>
        }
      />
      <div className="stats-grid">
        {[
          { label: t("admin.stats.totalRequests"), value: metricsQuery.data?.totalRequests ?? 0 },
          { label: t("admin.stats.activeRequests"), value: metricsQuery.data?.activeRequests ?? 0 },
          { label: t("admin.stats.pendingRequests"), value: metricsQuery.data?.pendingRequests ?? 0 },
          {
            label: t("admin.stats.topCategory"),
            value: metricsQuery.data?.topCategory
              ? localizeRequestCategory(metricsQuery.data.topCategory, t)
              : "—",
          },
        ].map((item) => (
          <Card key={item.label}>
            <span className="stat-tile__label">{item.label}</span>
            <strong className="stat-tile__value">{item.value}</strong>
          </Card>
        ))}
      </div>

      <Card hover={false} className="news-toolbar">
        <div className="news-toolbar__grid">
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t("admin.news.searchPlaceholder")}
          />
          <Select value={category || "all"} onChange={(event) => updateParams({ category: event.target.value, page: "1" })}>
            <option value="all">{t("admin.news.allCategories")}</option>
            {NEWS_CATEGORY_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {t(categoryKeyMap[item] ?? item)}
              </option>
            ))}
          </Select>
          <Select value={type || "all"} onChange={(event) => updateParams({ type: event.target.value, page: "1" })}>
            <option value="all">{t("admin.news.allTypes")}</option>
            {NEWS_TYPE_OPTIONS.map((item) => (
              <option key={item.label} value={item.label}>
                {t(typeKeyMap[item.label] ?? item.label)}
              </option>
            ))}
          </Select>
          <Select value={period} onChange={(event) => updateParams({ period: event.target.value, page: "1" })}>
            <option value="all">{t("admin.news.periodAll")}</option>
            <option value="active">{t("admin.news.periodActive")}</option>
            <option value="finished">{t("admin.news.periodFinished")}</option>
            <option value="no_period">{t("admin.news.periodNoPeriod")}</option>
          </Select>
          <Select value={sort} onChange={(event) => updateParams({ sort: event.target.value, page: "1" })}>
            <option value="date_desc">{t("admin.news.sortNewest")}</option>
            <option value="date_asc">{t("admin.news.sortOldest")}</option>
          </Select>
        </div>
      </Card>

      <div className="news-grid news-grid--enhanced">
        {previewItems.map((item) => {
          const types = getNewsTypes(item);
          const primaryMeta = getNewsTypeMeta(types[0]);
          const Icon = primaryMeta.icon;
          const categoryValue = getNewsCategory(item);
          const periodValue = item.startAt
            ? `${formatNewsDate(item.startAt)}${item.endAt ? ` - ${formatNewsDate(item.endAt)}` : ""}`
            : "";
          const borderColor = getBorderColor(item.startAt, item.endAt);
          const statusMeta = getTranslationStatusMeta(item.translationStatus);

          return (
            <Card key={item.id} className="news-card news-card--enhanced" hover={false}>
              <div className="news-card__accent" style={{ backgroundColor: borderColor }} />
              <div className="news-card__head">
                <div className="news-card__type">
                  <span
                    className="news-card__type-icon"
                    style={{ backgroundColor: `${primaryMeta.color}16`, color: primaryMeta.color }}
                  >
                    <Icon size={18} />
                  </span>
                  <div>
                    <strong style={{ color: primaryMeta.color }}>
                      {t(typeKeyMap[types[0]] ?? types[0])}
                    </strong>
                    <time>{formatNewsDate(item.publishedAt || item.startAt || "")}</time>
                  </div>
                </div>
                {statusMeta ? (
                  <span className={`news-status-pill ${statusMeta.className}`}>
                    {statusMeta.icon}
                    {t(`news.translationStatus.${statusMeta.key}`)}
                  </span>
                ) : null}
              </div>
              <h3>{item.title}</h3>
              <p>{item.summary || item.body}</p>
              <div className="news-card__meta-list">
                <span>{periodValue || "—"}</span>
                <span className="news-category-chip">
                  {t(categoryKeyMap[categoryValue] ?? categoryValue)}
                </span>
              </div>
              <div className="news-card__actions">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingNews(item);
                    setModalOpen(true);
                  }}
                >
                  {t("common.edit")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void deleteNewsMutation.mutateAsync(item.id);
                  }}
                >
                  {t("common.delete")}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {!newsQuery.isLoading && previewItems.length === 0 ? (
        <Card className="news-empty-state" hover={false}>
          <h3>{t("news.noResults")}</h3>
          <p>{t("news.emptyFiltered")}</p>
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
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingNews(null);
        }}
        title={editingNews ? t("admin.news.editArticleTitle") : t("admin.publish")}
        description={t("admin.news.editorDescription")}
      >
        <NewsForm
          initialValue={formInitialValue}
          submitLabel={editingNews ? t("common.save") : t("admin.publish")}
          isSubmitting={createNewsMutation.isPending || updateNewsMutation.isPending}
          isTranslating={previewTranslationMutation.isPending}
          onCancel={() => {
            setModalOpen(false);
            setEditingNews(null);
          }}
          onTranslate={(value) =>
            previewTranslationMutation.mutateAsync({ title: value.title, content: value.body })
          }
          onSubmit={handleSubmit}
        />
      </Modal>
    </div>
  );
}
