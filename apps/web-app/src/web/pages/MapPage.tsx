import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, BarChart3, MapPin, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CivicRequest, MapMode, RequestStatus } from "../../types/platform";
import { IssueMap } from "../components/maps/IssueMap";
import { Tabs } from "../components/ui/Tabs";
import {
  localizeRequestCategory,
  localizeRequestPriority,
  localizeRequestProblemType,
  localizeRequestStatus,
} from "../lib/requestMeta";
import { platformApi, queryKeys } from "../services/platformApi";

const STATUS_OPTIONS: Array<{ key: "all" | RequestStatus; tone: string }> = [
  { key: "all", tone: "#64748b" },
  { key: "pending", tone: "#ff9500" },
  { key: "in_progress", tone: "#007aff" },
  { key: "closed", tone: "#34c759" },
];

const TIMELINE_COLORS = {
  all: "#94a3b8",
  pending: "#ff9500",
  closed: "#34c759",
} as const;

const PRIORITY_OPTIONS = ["all", "low", "medium", "high"] as const;
const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

type PriorityFilter = (typeof PRIORITY_OPTIONS)[number];
type StatusFilter = "all" | RequestStatus;
type Hotspot = { address: string; count: number; requests: CivicRequest[] };
type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

function normalizeLocale(language: string) {
  if (language.startsWith("kk") || language.startsWith("kz")) return "kk";
  if (language.startsWith("en")) return "en";
  return "ru";
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getLastMonthKeys(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return getMonthKey(date);
  });
}

function formatMonth(month: string, language: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1, 1);
  if (Number.isNaN(date.getTime())) return month;
  return new Intl.DateTimeFormat(normalizeLocale(language), { month: "short" }).format(date);
}

function formatRequestDate(value: string, language: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(normalizeLocale(language), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatWeekday(dayIndex: number, language: string) {
  const monday = new Date(2026, 0, 5 + dayIndex);
  return new Intl.DateTimeFormat(normalizeLocale(language), { weekday: "short" }).format(monday);
}

function formatRequestCount(count: number, language: string) {
  const locale = normalizeLocale(language);

  if (locale === "en") {
    return `${count} ${count === 1 ? "request" : "requests"}`;
  }

  if (locale === "kk") {
    return `${count} өтініш`;
  }

  const mod10 = count % 10;
  const mod100 = count % 100;
  const noun = mod10 === 1 && mod100 !== 11
    ? "заявка"
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
      ? "заявки"
      : "заявок";
  return `${count} ${noun}`;
}

function getTimelineSeriesLabel(key: string, t: TranslationFn) {
  if (key === "all") return t("map.analytics.seriesAll");
  if (key === "pending") return localizeRequestStatus("pending", t);
  return localizeRequestStatus("closed", t);
}

function getPriorityMatch(request: CivicRequest, priority: PriorityFilter) {
  if (priority === "all") return true;
  if (priority === "high") return request.priority === "high" || request.priority === "critical";
  if (priority === "medium") return request.priority === "medium" || request.priority === "warning";
  return request.priority === "low" || request.priority === "information";
}

function getStatusCount(requests: CivicRequest[], status: RequestStatus) {
  return requests.filter((request) => request.status === status).length;
}

export function MapPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedHotspotAddress, setSelectedHotspotAddress] = useState<string | null>(null);
  const mapShellRef = useRef<HTMLElement | null>(null);

  const mode = (searchParams.get("mode") as MapMode | null) ?? "all";
  const category = searchParams.get("category") ?? "all";
  const status = (searchParams.get("status") as StatusFilter | null) ?? "all";
  const priority = (searchParams.get("priority") as PriorityFilter | null) ?? "all";

  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: platformApi.getCurrentUser,
  });
  const currentUser = currentUserQuery.data ?? null;
  const mapMode: MapMode = mode === "my" && currentUser
    ? "my"
    : mode === "heatmap"
      ? "heatmap"
      : "all";
  const mapModeOptions = [
    { key: "all", label: t("map.filters.allRequests") },
    ...(currentUser ? [{ key: "my", label: t("map.filters.myRequests") }] : []),
    { key: "heatmap", label: t("map.filters.heatmap") },
  ];
  const categoriesQuery = useQuery({
    queryKey: [...queryKeys.categories, i18n.language],
    queryFn: platformApi.getCategories,
  });
  const publicRequestsQuery = useQuery({
    queryKey: [...queryKeys.publicRequests, i18n.language],
    queryFn: platformApi.getPublicRequests,
  });
  const myRequestsQuery = useQuery({
    queryKey: [...queryKeys.myRequests, i18n.language],
    queryFn: platformApi.getMyRequests,
  });

  const allRequests = useMemo(() => {
    const requestMap = new Map<string, CivicRequest>();

    for (const request of publicRequestsQuery.data ?? []) requestMap.set(request.id, request);
    for (const request of myRequestsQuery.data ?? []) requestMap.set(request.id, request);

    return Array.from(requestMap.values());
  }, [myRequestsQuery.data, publicRequestsQuery.data]);

  const filteredRequests = useMemo(() => {
    return allRequests.filter((request) => {
      const matchesMode = mapMode !== "my" || request.citizenId === currentUser?.id;
      const matchesCategory = category === "all" || request.categoryId === category;
      const matchesStatus = status === "all" || request.status === status;
      const matchesPriority = getPriorityMatch(request, priority);
      return matchesMode && matchesCategory && matchesStatus && matchesPriority;
    });
  }, [allRequests, category, currentUser?.id, mapMode, priority, status]);

  const isLoading = publicRequestsQuery.isLoading || myRequestsQuery.isLoading;
  const [filtersVisible, setFiltersVisible] = useState(true);
  const hasActiveFilters = mapMode !== "all" || category !== "all" || status !== "all" || priority !== "all";

  const statusCounts = useMemo(
    () => ({
      pending: getStatusCount(allRequests, "pending"),
      inProgress: getStatusCount(allRequests, "in_progress"),
      closed: getStatusCount(allRequests, "closed"),
    }),
    [allRequests],
  );

  const categoryData = useMemo(() => {
    const counts = new Map<string, { id: string; fallbackName: string; count: number }>();

    for (const request of allRequests) {
      const id = request.categoryId || request.categoryName || "other";
      const current = counts.get(id);

      if (current) {
        current.count += 1;
      } else {
        counts.set(id, {
          id,
          fallbackName: request.categoryName || id,
          count: 1,
        });
      }
    }

    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [allRequests]);

  const timelineData = useMemo(() => {
    const months = getLastMonthKeys(12);
    return months.map((month) => {
      const monthRequests = allRequests.filter((request) => getMonthKey(new Date(request.createdAt)) === month);
      return {
        month,
        label: formatMonth(month, i18n.language),
        all: monthRequests.length,
        pending: monthRequests.filter((request) => request.status === "pending").length,
        closed: monthRequests.filter((request) => request.status === "closed").length,
      };
    });
  }, [allRequests, i18n.language]);

  const hotspots = useMemo<Hotspot[]>(() => {
    const groups = new Map<string, Hotspot>();

    for (const request of allRequests) {
      const address = request.address || "—";
      const current = groups.get(address);
      if (current) {
        current.count += 1;
        current.requests.push(request);
      } else {
        groups.set(address, { address, count: 1, requests: [request] });
      }
    }

    return Array.from(groups.values()).sort((a, b) => b.count - a.count).slice(0, 7);
  }, [allRequests]);

  const selectedHotspot = useMemo(
    () => hotspots.find((item) => item.address === selectedHotspotAddress) ?? null,
    [hotspots, selectedHotspotAddress],
  );
  const selectedRequest = selectedHotspot ? null : filteredRequests.find((request) => request.id === selectedId) ?? null;
  const mapRequests = selectedHotspot ? selectedHotspot.requests : filteredRequests;
  const activeMapMode: MapMode = selectedHotspot ? "all" : mapMode;

  const activityData = useMemo(() => {
    const matrix = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    for (const request of allRequests) {
      const date = new Date(request.createdAt);
      if (Number.isNaN(date.getTime())) continue;
      const mondayFirstDay = (date.getDay() + 6) % 7;
      matrix[mondayFirstDay][date.getHours()] += 1;
    }
    const max = Math.max(...matrix.flat(), 1);
    return { matrix, max };
  }, [allRequests]);

  function updateFilter(key: "mode" | "category" | "status" | "priority", value: string) {
    setSelectedHotspotAddress(null);
    const next = new URLSearchParams(searchParams);
    if (value === "all") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  }

  function resetFilters() {
    setSelectedHotspotAddress(null);
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  function focusHotspot(hotspot: Hotspot) {
    setSelectedId(null);
    setSelectedHotspotAddress(hotspot.address);
    requestAnimationFrame(() => {
      mapShellRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  return (
    <div className="map-page">
      <section className="map-page__hero">
        <div>
          <span className="map-page__eyebrow">iKOMEK 109</span>
          <h1>{t("map.title")}</h1>
          <p>{t("map.subtitleWithCount", { count: allRequests.length })}</p>
        </div>
        <div className="map-page__hero-actions">
          <div className="map-page__status-row">
            <span><i style={{ background: "#ff9500" }} />{statusCounts.pending} {localizeRequestStatus("pending", t)}</span>
            <span><i style={{ background: "#007aff" }} />{statusCounts.inProgress} {localizeRequestStatus("in_progress", t)}</span>
            <span><i style={{ background: "#34c759" }} />{statusCounts.closed} {localizeRequestStatus("closed", t)}</span>
          </div>
          <button
            type="button"
            className="map-page__filter-toggle"
            onClick={() => setFiltersVisible((value) => !value)}
          >
            {filtersVisible ? t("map.filters.hideFilters") : t("map.filters.showFilters")}
          </button>
        </div>
      </section>

      <section ref={mapShellRef} className="map-page__map-shell">
        {isLoading ? <div className="map-page__skeleton" /> : null}
        <IssueMap
          requests={mapRequests}
          currentUserId={currentUser?.id}
          mode={activeMapMode}
          onSelectRequest={(request) => {
            setSelectedHotspotAddress(null);
            setSelectedId(request.id);
          }}
          focusRequestId={selectedHotspot ? null : selectedId}
        />

        {filtersVisible ? (
          <div className="map-page__filters">
          <Tabs
            value={mapMode}
            onChange={(value) => updateFilter("mode", value)}
            options={mapModeOptions}
          />
          <select value={category} onChange={(event) => updateFilter("category", event.target.value)}>
            <option value="all">{t("map.filters.allCategories")}</option>
            {(categoriesQuery.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <div className="map-page__tag-row">
            {STATUS_OPTIONS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={status === item.key ? "is-active" : ""}
                onClick={() => updateFilter("status", item.key)}
              >
                {item.key === "all" ? t("map.filters.allStatuses") : localizeRequestStatus(item.key, t)}
              </button>
            ))}
          </div>
          <div className="map-page__tag-row">
            {PRIORITY_OPTIONS.map((item) => (
              <button
                key={item}
                type="button"
                className={priority === item ? "is-active" : ""}
                onClick={() => updateFilter("priority", item)}
              >
                {item === "all" ? t("map.filters.allPriorities") : localizeRequestPriority(item, t)}
              </button>
            ))}
          </div>
          {hasActiveFilters ? (
            <button type="button" className="map-page__reset" onClick={resetFilters}>
              <RotateCcw size={15} /> {t("map.filters.reset")}
            </button>
          ) : null}
          </div>
        ) : null}

        {selectedHotspot ? (
          <article className="map-page__popup map-page__popup--hotspot">
            <div className="map-page__popup-header">
              <div>
                <strong>{selectedHotspot.address}</strong>
                <span>{formatRequestCount(selectedHotspot.count, i18n.language)}</span>
              </div>
              <button
                type="button"
                className="map-page__popup-close"
                onClick={() => setSelectedHotspotAddress(null)}
                aria-label={t("common.close")}
              >
                ×
              </button>
            </div>
            <div className="map-page__hotspot-requests">
              {selectedHotspot.requests.map((request) => (
                <button
                  key={request.id}
                  type="button"
                  className="map-page__hotspot-request"
                  onClick={() => navigate(`/requests/${request.id}`)}
                >
                  <strong>{localizeRequestProblemType(request.categoryId, request.title, t)}</strong>
                  <span>{localizeRequestStatus(request.statusLabel || request.status, t)}</span>
                  <small>{formatRequestDate(request.createdAt, i18n.language)}</small>
                </button>
              ))}
            </div>
          </article>
        ) : selectedRequest ? (
          <article className="map-page__popup">
            <strong>{localizeRequestProblemType(selectedRequest.categoryId, selectedRequest.title, t)}</strong>
            <span>{selectedRequest.address}</span>
            <small>{localizeRequestCategory(selectedRequest.categoryId || selectedRequest.categoryName, t)}</small>
            <div className="map-page__popup-meta">
              <b>{localizeRequestStatus(selectedRequest.statusLabel || selectedRequest.status, t)}</b>
              <small>{formatRequestDate(selectedRequest.createdAt, i18n.language)}</small>
            </div>
            <button type="button" className="map-page__popup-action" onClick={() => navigate(`/requests/${selectedRequest.id}`)}>
              {t("common.details", "Подробнее")}
            </button>
          </article>
        ) : null}
      </section>

      <motion.section
        className="map-analytics"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
      >
        <div className="map-analytics__header">
          <BarChart3 size={24} />
          <h2>{t("map.analytics.title")}</h2>
        </div>
        <div className="map-analytics__grid">
          <AnalyticsCard title={t("map.analytics.categories")}>
            {categoryData.length ? (
              <div className="density-list">
                {categoryData.map((item) => {
                  const max = Math.max(...categoryData.map((category) => category.count), 1);
                  return (
                    <div key={item.id} className="density-list__item">
                      <span>{localizeRequestCategory(item.id, t) || item.fallbackName}</span>
                      <div><i style={{ width: `${Math.max((item.count / max) * 100, 6)}%` }} /></div>
                      <b>{formatRequestCount(item.count, i18n.language)}</b>
                    </div>
                  );
                })}
              </div>
            ) : <EmptyAnalytics label={t("map.analytics.insufficientData")} />}
          </AnalyticsCard>

          <AnalyticsCard title={t("map.analytics.timeline")}>
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="mapTimelineAll" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor={TIMELINE_COLORS.all} stopOpacity={0.22} />
                    <stop offset="95%" stopColor={TIMELINE_COLORS.all} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis width={28} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip
                  formatter={(value, name) => [
                    formatRequestCount(Number(value), i18n.language),
                    getTimelineSeriesLabel(String(name), t),
                  ]}
                />
                <Area name="all" type="monotone" dataKey="all" stroke={TIMELINE_COLORS.all} fill="url(#mapTimelineAll)" strokeWidth={3} />
                <Area name="pending" type="monotone" dataKey="pending" stroke={TIMELINE_COLORS.pending} fill="transparent" strokeWidth={2} />
                <Area name="closed" type="monotone" dataKey="closed" stroke={TIMELINE_COLORS.closed} fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="timeline-legend">
              <span><i style={{ background: TIMELINE_COLORS.all }} />{t("map.analytics.seriesAll")}</span>
              <span><i style={{ background: TIMELINE_COLORS.pending }} />{localizeRequestStatus("pending", t)}</span>
              <span><i style={{ background: TIMELINE_COLORS.closed }} />{localizeRequestStatus("closed", t)}</span>
            </div>
          </AnalyticsCard>

          <AnalyticsCard title={t("map.analytics.hotspots")}>
            {hotspots.length ? (
              <div className="hotspot-list">
                {hotspots.map((item, index) => {
                  const max = Math.max(...hotspots.map((hotspot) => hotspot.count), 1);
                  return (
                    <button key={item.address} type="button" onClick={() => focusHotspot(item)}>
                      <span>#{index + 1}</span>
                      <strong>{item.address}</strong>
                      <i><em style={{ width: `${Math.max((item.count / max) * 100, 8)}%` }} /></i>
                      <b>{formatRequestCount(item.count, i18n.language)}</b>
                    </button>
                  );
                })}
              </div>
            ) : <EmptyAnalytics label={t("map.analytics.insufficientData")} />}
          </AnalyticsCard>

          <AnalyticsCard title={t("map.analytics.activity")}>
            <div className="activity-heatmap">
              <div className="activity-heatmap__hours">
                {Array.from({ length: 24 }, (_, hour) => (
                  <span key={hour}>{hour % 3 === 0 ? hour : ""}</span>
                ))}
              </div>
              {activityData.matrix.map((row, dayIndex) => (
                <div key={WEEKDAY_KEYS[dayIndex]} className="activity-heatmap__row">
                  <span>{formatWeekday(dayIndex, i18n.language)}</span>
                  {row.map((count, hour) => (
                    <i
                      key={hour}
                      title={`${formatWeekday(dayIndex, i18n.language)} ${hour}:00 — ${formatRequestCount(count, i18n.language)}`}
                      style={{ opacity: count ? 0.22 + (count / activityData.max) * 0.78 : 0.08 }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </AnalyticsCard>
        </div>
      </motion.section>
    </div>
  );
}

function AnalyticsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.article
      className="map-analytics__card"
      variants={{
        hidden: { opacity: 0, y: 18 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.28 } },
      }}
    >
      <div className="map-analytics__card-title">
        <Activity size={18} />
        <h3>{title}</h3>
      </div>
      {children}
    </motion.article>
  );
}

function EmptyAnalytics({ label }: { label: string }) {
  return (
    <div className="map-analytics__empty">
      <MapPin size={24} />
      <span>{label}</span>
    </div>
  );
}
