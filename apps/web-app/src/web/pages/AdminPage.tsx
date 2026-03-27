import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select, Textarea } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { platformApi, queryKeys, getErrorMessage } from "../services/platformApi";

export function AdminPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<{
    title: string;
    category: string;
    priority: "critical" | "warning" | "information";
    summary: string;
    body: string;
    location: string;
    startAt: string;
    endAt: string;
  }>({
    title: "",
    category: "",
    priority: "information",
    summary: "",
    body: "",
    location: "",
    startAt: new Date().toISOString().slice(0, 16),
    endAt: "",
  });

  const metricsQuery = useQuery({ queryKey: queryKeys.metrics, queryFn: platformApi.getMetrics });
  const newsQuery = useQuery({ queryKey: queryKeys.news, queryFn: platformApi.getNews });

  const createNewsMutation = useMutation({
    mutationFn: platformApi.createNews,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.news }),
        queryClient.invalidateQueries({ queryKey: queryKeys.alerts }),
      ]);
      setModalOpen(false);
      toast.success("News published");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

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
          { label: "Top category", value: metricsQuery.data?.topCategory ?? "—" },
        ].map((item) => (
          <Card key={item.label}>
            <span className="stat-tile__label">{item.label}</span>
            <strong className="stat-tile__value">{item.value}</strong>
          </Card>
        ))}
      </div>
      <div className="news-grid">
        {(newsQuery.data ?? []).slice(0, 6).map((item) => (
          <Card key={item.id} className="news-card">
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
          </Card>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t("admin.publish")}
        description="Create a news or alert entry in the shared city content stream."
      >
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            createNewsMutation.mutate({
              ...form,
              endAt: form.endAt || undefined,
            });
          }}
        >
          <Input label="Title" value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} />
          <Input label="Category" value={form.category} onChange={(event) => setForm((value) => ({ ...value, category: event.target.value }))} />
          <Select
            label="Priority"
            value={form.priority}
            onChange={(event) =>
              setForm((value) => ({
                ...value,
                priority: event.target.value as "critical" | "warning" | "information",
              }))
            }
          >
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="information">Information</option>
          </Select>
          <Input label="Location" value={form.location} onChange={(event) => setForm((value) => ({ ...value, location: event.target.value }))} />
          <Input label="Start at" type="datetime-local" value={form.startAt} onChange={(event) => setForm((value) => ({ ...value, startAt: event.target.value }))} />
          <Input label="End at" type="datetime-local" value={form.endAt} onChange={(event) => setForm((value) => ({ ...value, endAt: event.target.value }))} />
          <Textarea label="Summary" rows={3} value={form.summary} onChange={(event) => setForm((value) => ({ ...value, summary: event.target.value }))} />
          <Textarea label="Body" rows={6} value={form.body} onChange={(event) => setForm((value) => ({ ...value, body: event.target.value }))} />
          <Button type="submit" isLoading={createNewsMutation.isPending}>
            {t("common.create")}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
