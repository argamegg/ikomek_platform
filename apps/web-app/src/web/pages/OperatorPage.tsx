import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { CivicRequest, RequestPriority, RequestStatus } from "../../types/platform";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input, Select, Textarea } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { formatDate, getPriorityTone, getStatusTone } from "../lib/format";
import {
  localizeRequestDescription,
  localizeRequestPriority,
  localizeRequestProblemType,
  localizeRequestStatus,
} from "../lib/requestMeta";
import { getErrorMessage, platformApi, queryKeys } from "../services/platformApi";

const PRIORITY_OPTIONS: RequestPriority[] = ["low", "normal", "high"];

export function OperatorPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [status, setStatus] = useState<RequestStatus>("in_progress");
  const [priority, setPriority] = useState<RequestPriority>("normal");
  const [departmentName, setDepartmentName] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const requestsQuery = useQuery({
    queryKey: [...queryKeys.allRequests(), i18n.language],
    queryFn: () => platformApi.getAllRequests(),
  });
  const metricsQuery = useQuery({ queryKey: queryKeys.metrics, queryFn: platformApi.getMetrics });

  const selectedRequest = useMemo(
    () => requestsQuery.data?.find((item) => item.id === selectedRequestId) ?? null,
    [requestsQuery.data, selectedRequestId],
  );

  function openUpdateModal(request: CivicRequest) {
    setSelectedRequestId(request.id);
    setStatus(request.status);
    setPriority(request.priority);
    setDepartmentName(request.assignment?.departmentName ?? "");
    setInternalNote(request.internalNote ?? "");
  }

  const statusMutation = useMutation({
    mutationFn: () =>
      platformApi.updateRequestStatus(selectedRequestId ?? "", {
        status,
        priority,
        departmentName,
        internalNote,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.allRequests() }),
        selectedRequestId
          ? queryClient.invalidateQueries({ queryKey: queryKeys.request(selectedRequestId) })
          : Promise.resolve(),
      ]);
      setSelectedRequestId(null);
      toast.success("Status updated");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <div className="page-stack">
      <PageHeader title={t("operator.title")} description={t("operator.description")} />
      <div className="stats-grid">
        {[
          { label: "Total queue", value: metricsQuery.data?.totalRequests ?? 0 },
          { label: "Active", value: metricsQuery.data?.activeRequests ?? 0 },
          { label: "Pending", value: metricsQuery.data?.pendingRequests ?? 0 },
          { label: "Avg response", value: metricsQuery.data?.averageResponseTime ?? "—" },
        ].map((item) => (
          <Card key={item.label}>
            <span className="stat-tile__label">{item.label}</span>
            <strong className="stat-tile__value">{item.value}</strong>
          </Card>
        ))}
      </div>
      <div className="request-card-grid">
        {(requestsQuery.data ?? []).map((request) => (
          <Card key={request.id} className="request-card">
            <div className="request-card__top">
              <div>
                <Badge tone={getPriorityTone(request.priority)}>{localizeRequestPriority(request.priority, t)}</Badge>
                <h3>{localizeRequestProblemType(request.categoryId || request.categoryName, request.title, t)}</h3>
              </div>
              <Badge tone={getStatusTone(request.status)}>{localizeRequestStatus(request.statusLabel || request.status, t)}</Badge>
            </div>
            <p>{localizeRequestDescription(request.description, request.categoryId, request.title, request.reasonId || request.reasonName, t)}</p>
            <div className="request-card__meta">
              <span>{request.address}</span>
              <span>{formatDate(request.createdAt, i18n.language as "en" | "ru" | "kz")}</span>
            </div>
            <Button variant="secondary" onClick={() => openUpdateModal(request)}>
              {t("operator.update")}
            </Button>
          </Card>
        ))}
      </div>

      <Modal
        open={Boolean(selectedRequest)}
        onClose={() => setSelectedRequestId(null)}
        title={selectedRequest ? localizeRequestProblemType(selectedRequest.categoryId || selectedRequest.categoryName, selectedRequest.title, t) : t("operator.update")}
        description={selectedRequest?.address}
      >
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            statusMutation.mutate();
          }}
        >
          <Select value={status} onChange={(event) => setStatus(event.target.value as RequestStatus)}>
            <option value="pending">{localizeRequestStatus("pending", t)}</option>
            <option value="in_progress">{localizeRequestStatus("in_progress", t)}</option>
            <option value="closed">{localizeRequestStatus("closed", t)}</option>
            <option value="resolved">{localizeRequestStatus("resolved", t)}</option>
          </Select>
          <div className="operator-priority-field">
            <span className="field__label">{t("operator.priority")}</span>
            <div className="operator-priority-options" role="radiogroup" aria-label={t("operator.priority")}>
              {PRIORITY_OPTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={priority === item ? "is-active" : ""}
                  onClick={() => setPriority(item)}
                  aria-pressed={priority === item}
                >
                  <Badge tone={getPriorityTone(item)}>{localizeRequestPriority(item, t)}</Badge>
                </button>
              ))}
            </div>
          </div>
          <Input value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} placeholder="Department name" />
          <Textarea rows={5} value={internalNote} onChange={(event) => setInternalNote(event.target.value)} placeholder="Internal note" />
          <Button type="submit" isLoading={statusMutation.isPending}>
            {t("common.update")}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
