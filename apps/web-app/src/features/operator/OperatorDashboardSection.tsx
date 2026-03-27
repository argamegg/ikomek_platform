import { type FormEvent, useDeferredValue, useState } from "react";
import type { Copy } from "../../App";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { filterRequests, getOperatorPriorityQueue } from "../../store/requestStore";
import type { CivicRequest, RequestStatus } from "../../types/platform";
import { formatStatus } from "../../utils/formatters";

type OperatorDashboardSectionProps = {
  copy: Copy;
  requests: CivicRequest[];
  onUpdateStatus: (requestId: string, payload: {
    status: RequestStatus;
    departmentName?: string;
    internalNote?: string;
  }) => Promise<unknown>;
};

export function OperatorDashboardSection({
  copy,
  requests,
  onUpdateStatus,
}: OperatorDashboardSectionProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(requests[0]?.id ?? null);
  const [status, setStatus] = useState<"all" | RequestStatus>("all");
  const [form, setForm] = useState({
    status: "in_progress" as RequestStatus,
    departmentName: "",
    internalNote: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);
  const queue = getOperatorPriorityQueue(filterRequests(requests, deferredQuery, status));
  const selected = queue.find((item) => item.id === selectedId) ?? queue[0];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected) {
      return;
    }

    try {
      await onUpdateStatus(selected.id, form);
      setMessage("Request updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request update failed.");
    }
  }

  return (
    <section className="section">
      <SectionHeading
        kicker={copy.operator.kicker}
        title={copy.operator.title}
        description={copy.operator.description}
      />
      <div className="cards-grid cards-grid--two">
        <Card>
          <div className="toolbar-card">
            <input
              className="text-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, address, or citizen"
            />
            <select
              className="text-input"
              value={status}
              onChange={(event) => setStatus(event.target.value as "all" | RequestStatus)}
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div className="request-list">
            {queue.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === selected?.id ? "selection-card is-active" : "selection-card"}
                onClick={() => setSelectedId(item.id)}
              >
                <strong>{item.title}</strong>
                <span>{item.address}</span>
                <span>{formatStatus(item.status)}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <h3>{selected?.title ?? "No request selected"}</h3>
          {selected ? (
            <form className="form-grid" onSubmit={handleSubmit}>
              <label className="form-field">
                <span>Status</span>
                <select
                  className="text-input"
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as RequestStatus,
                    }))
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In progress</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
              <label className="form-field">
                <span>Department</span>
                <input
                  className="text-input"
                  value={form.departmentName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      departmentName: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="form-field">
                <span>Internal note</span>
                <textarea
                  className="text-input text-input--area"
                  rows={5}
                  value={form.internalNote}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      internalNote: event.target.value,
                    }))
                  }
                />
              </label>
              <Button label="Update request" type="submit" />
            </form>
          ) : (
            <p>No queued requests available.</p>
          )}
          {message ? <p className="form-status">{message}</p> : null}
        </Card>
      </div>
    </section>
  );
}
