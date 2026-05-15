import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Files,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { CivicRequest, Locale, RequestPriority, RequestStatus } from "../../types/platform";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { formatDate, getPriorityBadgeClass, getStatusTone } from "../lib/format";
import {
  localizeRequestDescription,
  localizeRequestPriority,
  localizeRequestProblemType,
  localizeRequestStatus,
} from "../lib/requestMeta";
import { platformApi, queryKeys } from "../services/platformApi";

type FilterMode = "all" | "pending" | "in_progress" | "closed";
type ScopeMode = "all" | "mine";
type PriorityFilter = "all" | RequestPriority;
type SortMode = "newest" | "oldest" | "priority";

const STATUS_FILTERS: FilterMode[] = ["all", "pending", "in_progress", "closed"];
const PRIORITY_FILTERS: PriorityFilter[] = ["all", "high", "medium", "low"];
const REQUESTS_PAGE_SIZE = 12;
const PRIORITY_SORT_WEIGHT: Record<RequestPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function getStatusCount(requests: CivicRequest[], status: RequestStatus) {
  return requests.filter((request) => request.status === status).length;
}

function normalizeLocale(language: string): Locale {
  if (language.startsWith("ru")) return "ru";
  if (language.startsWith("kk") || language.startsWith("kz")) return "kz";
  return "en";
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

function canUseRequestChat(currentUser: Awaited<ReturnType<typeof platformApi.getCurrentUser>> | null, citizenId: string) {
  if (!currentUser) return false;

  return currentUser.roles.some((role) => role === "operator" || role === "admin")
    || currentUser.id === citizenId;
}

export function RequestsPage() {
  const { t, i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FilterMode>("all");
  const [scope, setScope] = useState<ScopeMode>("all");
  const [category, setCategory] = useState("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const publicRequestsQuery = useQuery({
    queryKey: [...queryKeys.publicRequests, i18n.language],
    queryFn: platformApi.getPublicRequests,
    staleTime: 30_000,
  });
  const myRequestsQuery = useQuery({
    queryKey: [...queryKeys.myRequests, i18n.language],
    queryFn: platformApi.getMyRequests,
    staleTime: 30_000,
  });
  const categoriesQuery = useQuery({
    queryKey: [...queryKeys.categories, i18n.language],
    queryFn: platformApi.getCategories,
    staleTime: 5 * 60_000,
  });
  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: platformApi.getCurrentUser,
  });
  const currentUser = currentUserQuery.data ?? null;

  const publicRequests = publicRequestsQuery.data ?? [];
  const myRequests = myRequestsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const sourceRequests = scope === "mine" ? myRequests : publicRequests;

  const filteredRequests = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return sourceRequests.filter((request) => {
      const matchesStatus = status === "all" || request.status === status;
      const matchesCategory = category === "all" || request.categoryId === category;
      const matchesPriority = priority === "all" || request.priority === priority;
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
  }, [category, deferredSearch, priority, sort, sourceRequests, status]);

  const scopeStats = useMemo(() => ({
    total: sourceRequests.length,
    pending: getStatusCount(sourceRequests, "pending"),
    inProgress: getStatusCount(sourceRequests, "in_progress"),
    closed: getStatusCount(sourceRequests, "closed"),
  }), [sourceRequests]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / REQUESTS_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRequests = useMemo(() => {
    const start = (safeCurrentPage - 1) * REQUESTS_PAGE_SIZE;
    return filteredRequests.slice(start, start + REQUESTS_PAGE_SIZE);
  }, [filteredRequests, safeCurrentPage]);
  const canGoBack = safeCurrentPage > 1;
  const canGoForward = safeCurrentPage < totalPages;

  useEffect(() => {
    setCurrentPage(1);
  }, [category, deferredSearch, priority, scope, sort, status]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const isLoading = publicRequestsQuery.isLoading || myRequestsQuery.isLoading;

  return (
    <div className="requests-workspace">
      <section className="requests-hero">
        <div>
          <span className="requests-eyebrow">
            <Sparkles size={16} />
            {t("requests.eyebrow")}
          </span>
          <h1>{t("requests.title")}</h1>
          <p>{t("requests.description")}</p>
        </div>
        <div className="requests-hero__aside">
          <span>{t("requests.heroLabel")}</span>
          <strong>{scopeStats.total}</strong>
          <small>{scope === "mine" ? t("requests.personalList") : t("requests.publicList")}</small>
        </div>
      </section>

      <section className="requests-overview">
        <article>
          <Files size={22} />
          <span>{t("requests.statsTotal")}</span>
          <strong>{scopeStats.total}</strong>
        </article>
        <article>
          <Clock3 size={22} />
          <span>{t("requests.filtersPending")}</span>
          <strong>{scopeStats.pending}</strong>
        </article>
        <article>
          <ShieldCheck size={22} />
          <span>{t("requests.filtersProgress")}</span>
          <strong>{scopeStats.inProgress}</strong>
        </article>
        <article>
          <CheckCircle2 size={22} />
          <span>{t("requests.filtersClosed")}</span>
          <strong>{scopeStats.closed}</strong>
        </article>
      </section>

      <section className="requests-command">
        <div className="requests-scope-tabs" role="tablist" aria-label={t("requests.scopeLabel")}>
          {(["all", "mine"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={scope === item ? "is-active" : ""}
              onClick={() => setScope(item)}
            >
              <span>{item === "all" ? t("requests.scopeAll") : t("requests.scopeMine")}</span>
              <b>{item === "all" ? publicRequests.length : myRequests.length}</b>
            </button>
          ))}
        </div>

        <div className="requests-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("requests.searchPlaceholder")}
          />
        </div>

        <div className="requests-status-tabs" role="tablist" aria-label={t("requests.statusFilterLabel")}>
          {STATUS_FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              className={status === item ? "is-active" : ""}
              onClick={() => setStatus(item)}
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
              className={priority === item ? "is-active" : ""}
              onClick={() => setPriority(item)}
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
            <span>{scope === "mine" ? t("requests.personalList") : t("requests.publicList")}</span>
            <h2>{t("requests.listTitle", { count: filteredRequests.length })}</h2>
          </div>
          <p>{t("requests.listHint")}</p>
        </div>

        <div className="requests-grid">
          {paginatedRequests.map((request) => (
            <article key={request.id} className="request-tile">
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
                  <span>{scope === "mine" ? t("requests.requestId") : t("requests.author")}</span>
                  <strong>{scope === "mine" ? `#${request.id.slice(0, 8)}` : request.citizenName || t("requests.unknownAuthor")}</strong>
                </div>
                <div className="request-tile__actions">
                  {canUseRequestChat(currentUser, request.citizenId) ? (
                    <Link to={`/requests/${request.id}/chat`} aria-label={t("common.chat")}>
                      <MessageCircle size={17} />
                    </Link>
                  ) : null}
                  <Link to={`/requests/${request.id}`}>
                    {t("common.details")}
                    <ArrowUpRight size={16} />
                  </Link>
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

        {!filteredRequests.length && !isLoading ? (
          <EmptyState title={t("requests.empty")} description={t("emptyStates.genericDescription")} />
        ) : null}
      </section>
    </div>
  );
}
