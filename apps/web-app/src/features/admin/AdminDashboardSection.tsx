import { type FormEvent, useState } from "react";
import type { Copy } from "../../App";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { SectionHeading } from "../../components/ui/SectionHeading";
import type { PlatformMetrics, RequestCategory } from "../../types/platform";

type AdminDashboardSectionProps = {
  copy: Copy;
  metrics: PlatformMetrics | null;
  categories: RequestCategory[];
  onPublishNews: (payload: {
    title: string;
    category: string;
    priority: "critical" | "warning" | "information";
    summary: string;
    body: string;
    location: string;
    startAt: string;
    endAt?: string;
  }) => Promise<unknown>;
};

export function AdminDashboardSection({
  copy,
  metrics,
  categories,
  onPublishNews,
}: AdminDashboardSectionProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    category: "roads",
    priority: "information" as const,
    summary: "",
    body: "",
    location: "Astana",
    startAt: new Date().toISOString().slice(0, 16),
    endAt: "",
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await onPublishNews({
        ...form,
        endAt: form.endAt || undefined,
      });
      setStatus("News item published.");
      setForm((current) => ({
        ...current,
        title: "",
        summary: "",
        body: "",
      }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Publishing failed.");
    }
  }

  return (
    <section className="section">
      <SectionHeading
        kicker={copy.admin.kicker}
        title={copy.admin.title}
        description={copy.admin.description}
      />
      <div className="cards-grid cards-grid--three">
        <Card>
          <h3>Total requests</h3>
          <strong className="section-metric">{metrics?.totalRequests ?? "—"}</strong>
        </Card>
        <Card>
          <h3>Average response time</h3>
          <strong className="section-metric">{metrics?.averageResponseTime ?? "—"}</strong>
        </Card>
        <Card>
          <h3>Tracked categories</h3>
          <strong className="section-metric">{categories.length}</strong>
        </Card>
      </div>
      <Card>
        <h3>Publish news or alert</h3>
        <form className="form-grid form-grid--two" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Title</span>
            <input
              className="text-input"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              required
            />
          </label>
          <label className="form-field">
            <span>Category</span>
            <input
              className="text-input"
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              required
            />
          </label>
          <label className="form-field">
            <span>Priority</span>
            <select
              className="text-input"
              value={form.priority}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  priority: event.target.value as typeof form.priority,
                }))
              }
            >
              <option value="information">Information</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label className="form-field">
            <span>Location</span>
            <input
              className="text-input"
              value={form.location}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
            />
          </label>
          <label className="form-field form-field--full">
            <span>Summary</span>
            <textarea
              className="text-input text-input--area"
              rows={3}
              value={form.summary}
              onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
            />
          </label>
          <label className="form-field form-field--full">
            <span>Body</span>
            <textarea
              className="text-input text-input--area"
              rows={6}
              value={form.body}
              onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
            />
          </label>
          <label className="form-field">
            <span>Start</span>
            <input
              className="text-input"
              type="datetime-local"
              value={form.startAt}
              onChange={(event) => setForm((current) => ({ ...current, startAt: event.target.value }))}
            />
          </label>
          <label className="form-field">
            <span>End</span>
            <input
              className="text-input"
              type="datetime-local"
              value={form.endAt}
              onChange={(event) => setForm((current) => ({ ...current, endAt: event.target.value }))}
            />
          </label>
          <Button label="Publish news" type="submit" />
        </form>
        {status ? <p className="form-status">{status}</p> : null}
      </Card>
    </section>
  );
}
