import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Files,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { CivicRequest, Locale, RequestPriority, RequestStatus } from "../../types/platform";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Input, Select, Textarea } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { formatDate, getPriorityBadgeClass, getStatusTone } from "../lib/format";
import {
  localizeRequestDescription,
  localizeRequestPriority,
  localizeRequestProblemType,
  localizeRequestStatus,
} from "../lib/requestMeta";
import { getErrorMessage, platformApi, queryKeys } from "../services/platformApi";

type StatusFilter = "all" | "pending" | "in_progress" | "closed";
type OperatorStatus = Exclude<StatusFilter, "all">;
type PriorityFilter = "all" | RequestPriority;
type SortMode = "newest" | "oldest" | "priority";

const STATUS_FILTERS: StatusFilter[] = ["all", "pending", "in_progress", "closed"];
const STATUS_OPTIONS: OperatorStatus[] = ["pending", "in_progress", "closed"];
const PRIORITY_FILTERS: PriorityFilter[] = ["all", "high", "medium", "low"];
const PRIORITY_OPTIONS: RequestPriority[] = ["low", "medium", "high"];
const OPERATOR_PAGE_SIZE = 12;
const PRIORITY_SORT_WEIGHT: Record<RequestPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function normalizeLocale(language: string): Locale {
  if (language.startsWith("ru")) return "ru";
  if (language.startsWith("kk") || language.startsWith("kz")) return "kz";
  return "en";
}

function getStatusCount(requests: CivicRequest[], status: RequestStatus) {
  return requests.filter((request) => request.status === status).length;
}

function getRequestSearchText(request: CivicRequest) {
  return [
    request.id,
    request.title,
    request.address,
    request.categoryName,
    request.reasonName,
    request.description,
    request.citizenName,
  ].filter(Boolean).join(" ").toLowerCase();
}

function toOperatorStatus(status: RequestStatus): OperatorStatus {
  if (status === "in_progress" || status === "closed") {
    return status;
  }

  return "pending";
}

export function OperatorPage() {
  const { t, i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language);
  const queryClient = useQueryClient();
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<OperatorStatus>("in_progress");
  const [priorityDraft, setPriorityDraft] = useState<RequestPriority>("medium");
  const [departmentName, setDepartmentName] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [category, setCategory] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const requestsQuery = useQuery({
    queryKey: [...queryKeys.allRequests(), i18n.language],
    queryFn: () => platformApi.getAllRequests(),
  });
  const categoriesQuery = useQuery({
    queryKey: [...queryKeys.categories, i18n.language],
    queryFn: platformApi.getCategories,
    staleTime: 5 * 60_000,
  });

  const requests = requestsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const selectedRequest = useMemo(
    () => requests.find((item) => item.id === selectedRequestId) ?? null,
    [requests, selectedRequestId],
  );

  const filteredRequests = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      const matchesCategory = category === "all" || request.categoryId === category;
      const matchesPriority = priorityFilter === "all" || request.priority === priorityFilter;
      const matchesSearch = !query || getRequestSearchText(request).includes(query);
      return matchesStatus && matchesCategory && matchesPriority && matchesSearch;
    }).sort((first, second) => {
      if (sort === "priority") {
        const priorityDiff = PRIORITY_SORT_WEIGHT[second.priority] - PRIORITY_SORT_WEIGHT[first.priority];
        if (priorityDiff !== 0) return priorityDiff;
      }

      const firstTime = new Date(first.updatedAt || first.createdAt).getTime();
      const secondTime = new Date(second.updatedAt || second.createdAt).getTime();
      return sort === "oldest" ? firstTime - secondTime : secondTime - firstTime;
    });
  }, [category, deferredSearch, priorityFilter, requests, sort, statusFilter]);

  const stats = useMemo(() => ({
    total: requests.length,
    pending: getStatusCount(requests, "pending"),
    inProgress: getStatusCount(requests, "in_progress"),
    closed: getStatusCount(requests, "closed"),
  }), [requests]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / OPERATOR_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRequests = useMemo(() => {
    const start = (safeCurrentPage - 1) * OPERATOR_PAGE_SIZE;
    return filteredRequests.slice(start, start + OPERATOR_PAGE_SIZE);
  }, [filteredRequests, safeCurrentPage]);
  const canGoBack = safeCurrentPage > 1;
  const canGoForward = safeCurrentPage < totalPages;

  useEffect(() => {
    setCurrentPage(1);
  }, [category, deferredSearch, priorityFilter, sort, statusFilter]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  function openUpdateModal(request: CivicRequest) {
    setSelectedRequestId(request.id);
    setStatusDraft(toOperatorStatus(request.status));
    setPriorityDraft(request.priority);
    setDepartmentName(request.assignment?.departmentName ?? "");
    setInternalNote(request.internalNote ?? "");
    setResolutionNote("");
  }

  function closeUpdateModal() {
    setSelectedRequestId(null);
    setDepartmentName("");
    setInternalNote("");
    setResolutionNote("");
  }

  const statusMutation = useMutation({
    mutationFn: () => {
      if (!selectedRequestId) {
        throw new Error(t("operator.noRequestSelected"));
      }

      const trimmedResolutionNote = resolutionNote.trim();
      if (statusDraft === "closed" && !trimmedResolutionNote) {
        throw new Error(t("operator.closeCommentRequired"));
      }

      return platformApi.updateRequestStatus(selectedRequestId, {
        status: statusDraft,
        priority: priorityDraft,
        departmentName: departmentName.trim() || undefined,
        internalNote: internalNote.trim() || undefined,
        resolutionNote: statusDraft === "closed" ? trimmedResolutionNote : undefined,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.allRequests() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.metrics }),
        queryClient.invalidateQueries({ queryKey: queryKeys.publicRequests }),
        selectedRequestId
          ? queryClient.invalidateQueries({ queryKey: queryKeys.request(selectedRequestId) })
          : Promise.resolve(),
      ]);
      closeUpdateModal();
      toast.success(t("operator.updateSuccess"));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <div className="requests-workspace operator-workspace">
      <section className="requests-hero">
        <div>
          <span className="requests-eyebrow">
            <Sparkles size={16} />
            {t("operator.eyebrow")}
          </span>
          <h1>{t("operator.title")}</h1>
          <p>{t("operator.description")}</p>
        </div>
        <div className="requests-hero__aside">
          <span>{t("operator.visibleNow")}</span>
          <strong>{filteredRequests.length}</strong>
          <small>{t("operator.queueLabel")}</small>
        </div>
      </section>

      <section className="requests-overview">
        <article>
          <Files size={22} />
          <span>{t("operator.stats.totalQueue")}</span>
          <strong>{stats.total}</strong>
        </article>
        <article>
          <Clock3 size={22} />
          <span>{t("operator.stats.pending")}</span>
          <strong>{stats.pending}</strong>
        </article>
        <article>
          <ShieldCheck size={22} />
          <span>{t("operator.stats.inProgress")}</span>
          <strong>{stats.inProgress}</strong>
        </article>
        <article>
          <CheckCircle2 size={22} />
          <span>{t("operator.stats.closed")}</span>
          <strong>{stats.closed}</strong>
        </article>
      </section>

      <section className="requests-command operator-command">
        <div className="requests-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("operator.searchPlaceholder")}
          />
        </div>

        <div className="requests-status-tabs" role="tablist" aria-label={t("requests.statusFilterLabel")}>
          {STATUS_FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              className={statusFilter === item ? "is-active" : ""}
              onClick={() => setStatusFilter(item)}
            >
              {item === "all" ? t("requests.filtersAll") : localizeRequestStatus(item, t)}
            </button>
          ))}
        </div>
      </section>

      <section className="requests-filter-panel" aria-label={t("requests.moreFilters")}>
        <div className="requests-filter-panel__label">
          <SlidersHorizontal size={18} />
          <span>{t("requests.moreFilters")}</span>
        </div>

        <label className="requests-select">
          <span>{t("requests.filterCategory")}</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">{t("requests.allCategories")}</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>

        <div className="requests-priority-tabs" role="tablist" aria-label={t("requests.filterPriority")}>
          {PRIORITY_FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              className={priorityFilter === item ? "is-active" : ""}
              onClick={() => setPriorityFilter(item)}
            >
              {item === "all" ? t("requests.allPriorities") : localizeRequestPriority(item, t)}
            </button>
          ))}
        </div>

        <label className="requests-select requests-select--compact">
          <span>{t("requests.sortLabel")}</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
            <option value="newest">{t("requests.sortNewest")}</option>
            <option value="oldest">{t("requests.sortOldest")}</option>
            <option value="priority">{t("requests.sortPriority")}</option>
          </select>
        </label>
      </section>

      <section className="requests-list-section">
        <div className="requests-section-heading">
          <div>
            <span>{t("operator.queueLabel")}</span>
            <h2>{t("operator.listTitle", { count: filteredRequests.length })}</h2>
          </div>
          <p>{t("operator.listHint")}</p>
        </div>

        <div className="requests-grid">
          {paginatedRequests.map((request) => (
            <article key={request.id} className="request-tile operator-ticket">
              <div className="request-tile__header">
                <Badge className={getPriorityBadgeClass(request.priority)}>
                  {localizeRequestPriority(request.priority, t)}
                </Badge>
                <Badge tone={getStatusTone(request.status)}>
                  {localizeRequestStatus(request.statusLabel || request.status, t)}
                </Badge>
              </div>

              <div className="request-tile__body">
                <h3>{localizeRequestProblemType(request.categoryId || request.categoryName, request.title, t)}</h3>
                <p>{localizeRequestDescription(request.description, request.categoryId, request.title, request.reasonId || request.reasonName, t)}</p>
              </div>

              <div className="request-tile__meta">
                <span>
                  <MapPin size={15} />
                  {request.address}
                </span>
                <span>{formatDate(request.updatedAt || request.createdAt, locale)}</span>
              </div>

              <div className="request-tile__footer">
                <div>
                  <span>{t("requests.author")}</span>
                  <strong>{request.citizenName || t("requests.unknownAuthor")}</strong>
                </div>
                <div className="request-tile__actions operator-ticket__actions">
                  <Link to={`/requests/${request.id}`}>
                    {t("operator.details")}
                    <ArrowUpRight size={16} />
                  </Link>
                  <button type="button" onClick={() => openUpdateModal(request)}>
                    {t("operator.update")}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {filteredRequests.length ? (
          <nav className="requests-pagination" aria-label={t("requests.paginationLabel")}>
            <button
              type="button"
              disabled={!canGoBack}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              {t("requests.paginationPrevious")}
            </button>
            <span aria-live="polite">{safeCurrentPage} / {totalPages}</span>
            <button
              type="button"
              disabled={!canGoForward}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            >
              {t("requests.paginationNext")}
            </button>
          </nav>
        ) : null}

        {!filteredRequests.length && !requestsQuery.isLoading ? (
          <EmptyState title={t("operator.empty")} description={t("emptyStates.genericDescription")} />
        ) : null}
      </section>

      <Modal
        open={Boolean(selectedRequest)}
        onClose={closeUpdateModal}
        title={selectedRequest ? localizeRequestProblemType(selectedRequest.categoryId || selectedRequest.categoryName, selectedRequest.title, t) : t("operator.update")}
        description={selectedRequest?.address}
      >
        {selectedRequest ? (
          <form
            className="form-stack operator-update-form"
            onSubmit={(event) => {
              event.preventDefault();
              statusMutation.mutate();
            }}
          >
            <div className="operator-modal-summary">
              <span>
                <UserRound size={16} />
                {selectedRequest.citizenName || t("requests.unknownAuthor")}
              </span>
              <span>#{selectedRequest.id.slice(0, 8)}</span>
            </div>

            <div className="form-grid">
              <Select
                label={t("requestDetails.status")}
                value={statusDraft}
                onChange={(event) => setStatusDraft(event.target.value as OperatorStatus)}
              >
                {STATUS_OPTIONS.map((item) => (
                  <option key={item} value={item}>{localizeRequestStatus(item, t)}</option>
                ))}
              </Select>
              <Input
                label={t("operator.department")}
                value={departmentName}
                onChange={(event) => setDepartmentName(event.target.value)}
                placeholder={t("operator.departmentPlaceholder")}
              />
            </div>

            <div className="operator-priority-field">
              <span className="field__label">{t("operator.priority")}</span>
              <div className="operator-priority-options" role="radiogroup" aria-label={t("operator.priority")}>
                {PRIORITY_OPTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`operator-priority-option operator-priority-option--${item}${priorityDraft === item ? " is-active" : ""}`}
                    onClick={() => setPriorityDraft(item)}
                    aria-pressed={priorityDraft === item}
                  >
                    <Badge className={getPriorityBadgeClass(item)}>{localizeRequestPriority(item, t)}</Badge>
                  </button>
                ))}
              </div>
            </div>

            <Textarea
              rows={4}
              label={t("operator.internalNote")}
              value={internalNote}
              onChange={(event) => setInternalNote(event.target.value)}
              placeholder={t("operator.internalNotePlaceholder")}
            />

            <Textarea
              rows={5}
              label={t("operator.closeComment")}
              helper={statusDraft === "closed" ? t("operator.closeCommentHelper") : t("operator.closeCommentOptional")}
              value={resolutionNote}
              onChange={(event) => setResolutionNote(event.target.value)}
              placeholder={t("operator.closeCommentPlaceholder")}
            />

            <div className="operator-modal-actions">
              <Button type="button" variant="secondary" onClick={closeUpdateModal}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" isLoading={statusMutation.isPending}>
                {t("operator.saveChanges")}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
