import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { NewsCreateInput, NewsItem } from "../../types/platform";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Textarea } from "../components/ui/Input";
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

const initialForm: NewsCreateInput = {
  title: "",
  category: "Дороги",
  types: ["Дорожные ситуации"],
  summary: "",
  body: "",
  location: "",
  startAt: new Date().toISOString().slice(0, 16),
  endAt: "",
};

function formatPreviewPeriod(startAt?: string, endAt?: string) {
  if (!startAt) {
    return "";
  }

  const formatter = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) {
    return "";
  }

  const startLabel = formatter.format(start);
  const end = endAt ? new Date(endAt) : null;
  const endLabel = end && !Number.isNaN(end.getTime()) ? formatter.format(end) : "";
  return endLabel ? `${startLabel} - ${endLabel}` : startLabel;
}

export function AdminPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<NewsCreateInput>(initialForm);

  const metricsQuery = useQuery({ queryKey: queryKeys.metrics, queryFn: platformApi.getMetrics });
  const newsQuery = useQuery({ queryKey: [...queryKeys.news, i18n.language], queryFn: platformApi.getNews });

  const createNewsMutation = useMutation({
    mutationFn: platformApi.createNews,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.news }),
        queryClient.invalidateQueries({ queryKey: queryKeys.alerts }),
      ]);
      setModalOpen(false);
      setForm(initialForm);
      toast.success("News published");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const previewItems = useMemo(() => (newsQuery.data ?? []).slice(0, 6), [newsQuery.data]);

  const toggleType = (type: NewsItem["types"][number]) => {
    setForm((current) => {
      const nextTypes = current.types.includes(type)
        ? current.types.filter((item) => item !== type)
        : [...current.types, type];

      return {
        ...current,
        types: nextTypes.length > 0 ? nextTypes : current.types,
      };
    });
  };

  return (
    <div className="page-stack">
      <PageHeader
        title={t("admin.title")}
        description={t("admin.description")}
        action={<Button onClick={() => setModalOpen(true)}>{t("admin.publish")}</Button>}
      />
      <div className="stats-grid">
        {[
          { label: "Total requests", value: metricsQuery.data?.totalRequests ?? 0 },
          { label: "Active requests", value: metricsQuery.data?.activeRequests ?? 0 },
          { label: "Pending requests", value: metricsQuery.data?.pendingRequests ?? 0 },
          { label: "Top category", value: metricsQuery.data?.topCategory ? localizeRequestCategory(metricsQuery.data.topCategory, t) : "—" },
        ].map((item) => (
          <Card key={item.label}>
            <span className="stat-tile__label">{item.label}</span>
            <strong className="stat-tile__value">{item.value}</strong>
          </Card>
        ))}
      </div>

      <div className="news-grid news-grid--enhanced">
        {previewItems.map((item) => {
          const types = getNewsTypes(item);
          const primaryMeta = getNewsTypeMeta(types[0]);
          const category = getNewsCategory(item);
          const Icon = primaryMeta.icon;
          const period = formatPreviewPeriod(item.startAt, item.endAt);
          const borderColor = getBorderColor(item.startAt, item.endAt);

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
              </div>
              <h3>{item.title}</h3>
              <p>{item.summary || item.body}</p>
              {period ? (
                <div className="news-card__meta-list">
                  <span>{period}</span>
                  <span className="news-category-chip">
                    {t(categoryKeyMap[category] ?? category)}
                  </span>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t("admin.publish")}
        description="Создайте новость с одной категорией и несколькими типами."
      >
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();

            if (form.types.length === 0) {
              toast.error("Choose at least one news type");
              return;
            }

            createNewsMutation.mutate({
              ...form,
              summary: form.summary || form.body.slice(0, 180),
              endAt: form.endAt || undefined,
            });
          }}
        >
          <Input
            label="Title"
            value={form.title}
            onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))}
          />

          <div className="news-admin-section">
            <label>Category</label>
            <div className="news-admin-categories">
              {NEWS_CATEGORY_OPTIONS.map((category) => {
                const active = form.category === category;
                return (
                  <button
                    key={category}
                    type="button"
                    className={`news-category-pill${active ? " is-active" : ""}`}
                    onClick={() => setForm((value) => ({ ...value, category }))}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="news-admin-section">
            <label>Types</label>
            <div className="news-admin-types">
              {NEWS_TYPE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = form.types.includes(option.label);
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
            label="Location"
            value={form.location}
            onChange={(event) => setForm((value) => ({ ...value, location: event.target.value }))}
          />
          <Input
            label="Start at"
            type="datetime-local"
            value={form.startAt}
            onChange={(event) => setForm((value) => ({ ...value, startAt: event.target.value }))}
          />
          <Input
            label="End at"
            type="datetime-local"
            value={form.endAt ?? ""}
            onChange={(event) => setForm((value) => ({ ...value, endAt: event.target.value }))}
          />
          <Textarea
            label="Summary"
            rows={3}
            value={form.summary}
            onChange={(event) => setForm((value) => ({ ...value, summary: event.target.value }))}
          />
          <Textarea
            label="Body"
            rows={6}
            value={form.body}
            onChange={(event) => setForm((value) => ({ ...value, body: event.target.value }))}
          />
          <Button type="submit" isLoading={createNewsMutation.isPending}>
            {t("common.create")}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
