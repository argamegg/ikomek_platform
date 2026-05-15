import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, BarChart3, MapPin, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
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
const MAX_DATE_RANGE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

type PriorityFilter = (typeof PRIORITY_OPTIONS)[number];
type StatusFilter = "all" | RequestStatus;
type Hotspot = { address: string; count: number; requests: CivicRequest[] };
type TranslationFn = (key: string, options?: Record<string, unknown>) => string;
type DateRange = { from: string; to: string };
type TimelineMode = "period" | "months";
type TimelineGranularity = "hours" | "weekdays" | "months";
type TimelinePoint = { key: string; label: string; all: number; pending: number; closed: number };

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

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function diffCalendarDays(from: Date, to: Date) {
  return Math.round((startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) / DAY_MS);
}

function toDateKey(date: Date) {
  const day = startOfLocalDay(date);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

function parseDateKey(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return startOfLocalDay(date);
}

function getDefaultDateRange(): DateRange {
  const today = startOfLocalDay(new Date());
  return {
    from: toDateKey(addDays(today, -(MAX_DATE_RANGE_DAYS - 1))),
    to: toDateKey(today),
  };
}

function normalizeDateRange(rawFrom?: string | null, rawTo?: string | null): DateRange {
  const fallback = getDefaultDateRange();
  const fromDate = parseDateKey(rawFrom);
  const toDate = parseDateKey(rawTo);
  if (!fromDate && !toDate) return fallback;

  const today = startOfLocalDay(new Date());
  let start = startOfLocalDay(fromDate ?? toDate ?? today);
  let end = startOfLocalDay(toDate ?? fromDate ?? today);

  if (start > end) {
    [start, end] = [end, start];
  }
  if (end > today) end = today;
  if (start > today) start = today;
  if (diffCalendarDays(start, end) >= MAX_DATE_RANGE_DAYS) {
    end = addDays(start, MAX_DATE_RANGE_DAYS - 1);
  }
  if (end > today) {
    end = today;
    start = addDays(end, -(MAX_DATE_RANGE_DAYS - 1));
  }

  return { from: toDateKey(start), to: toDateKey(end) };
}

function isDefaultDateRange(range: DateRange) {
  const fallback = getDefaultDateRange();
  return range.from === fallback.from && range.to === fallback.to;
}

function getDateRangeBounds(range: DateRange) {
  const from = parseDateKey(range.from) ?? parseDateKey(getDefaultDateRange().from)!;
  const to = parseDateKey(range.to) ?? parseDateKey(getDefaultDateRange().to)!;
  return {
    dateFrom: startOfLocalDay(from).toISOString(),
    dateTo: endOfLocalDay(to).toISOString(),
  };
}

function getDateRangeMatch(request: CivicRequest, range: DateRange) {
  const createdAt = new Date(request.createdAt).getTime();
  const from = parseDateKey(range.from);
  const to = parseDateKey(range.to);
  if (Number.isNaN(createdAt) || !from || !to) return false;
  return createdAt >= startOfLocalDay(from).getTime() && createdAt <= endOfLocalDay(to).getTime();
}

function getCalendarCells(monthDate: Date) {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startOffset = (monthStart.getDay() + 6) % 7;
  const gridStart = addDays(monthStart, -startOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    return {
      date,
      key: toDateKey(date),
      inMonth: date.getMonth() === monthStart.getMonth(),
    };
  });
}

function formatCalendarMonth(date: Date, language: string) {
  return new Intl.DateTimeFormat(normalizeLocale(language), {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateRangeLabel(range: DateRange, language: string) {
  const from = parseDateKey(range.from);
  const to = parseDateKey(range.to);
  if (!from || !to) return "";
  const locale = normalizeLocale(language);
  if (range.from === range.to) {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(from);
  }
  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    const month = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(to);
    return `${from.getDate()}-${to.getDate()} ${month}`;
  }
  return `${new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(from)} - ${new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(to)}`;
}

function getAllMonthsBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  return {
    dateFrom: startOfLocalDay(start).toISOString(),
    dateTo: endOfLocalDay(now).toISOString(),
  };
}

function getDateRangeDayCount(range: DateRange) {
  const from = parseDateKey(range.from);
  const to = parseDateKey(range.to);
  if (!from || !to) return MAX_DATE_RANGE_DAYS;
  return diffCalendarDays(from, to) + 1;
}

function createTimelinePoint(key: string, label: string): TimelinePoint {
  return { key, label, all: 0, pending: 0, closed: 0 };
}

function addRequestToTimelinePoint(point: TimelinePoint, request: CivicRequest) {
  point.all += 1;
  if (request.status === "pending") point.pending += 1;
  if (request.status === "closed") point.closed += 1;
}

function getWeekdayLabel(dayIndex: number, t: TranslationFn) {
  const keys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  return t(`map.analytics.weekdays.${keys[dayIndex]}`);
}

function buildHourlyTimelineData(requests: CivicRequest[]): TimelinePoint[] {
  const buckets = new Map(
    Array.from({ length: 12 }, (_, index) => {
      const hour = index * 2;
      const key = String(hour).padStart(2, "0");
      return [key, createTimelinePoint(key, `${key}:00`)] as const;
    }),
  );

  for (const request of requests) {
    const date = new Date(request.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const hour = Math.floor(date.getHours() / 2) * 2;
    const bucket = buckets.get(String(hour).padStart(2, "0"));
    if (bucket) addRequestToTimelinePoint(bucket, request);
  }

  return Array.from(buckets.values());
}

function buildWeekdayTimelineData(requests: CivicRequest[], t: TranslationFn): TimelinePoint[] {
  const buckets = new Map(
    Array.from({ length: 7 }, (_, index) => [
      String(index),
      createTimelinePoint(String(index), getWeekdayLabel(index, t)),
    ] as const),
  );

  for (const request of requests) {
    const date = new Date(request.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const dayIndex = (date.getDay() + 6) % 7;
    const bucket = buckets.get(String(dayIndex));
    if (bucket) addRequestToTimelinePoint(bucket, request);
  }

  return Array.from(buckets.values());
}

function buildMonthlyTimelineData(requests: CivicRequest[], language: string): TimelinePoint[] {
  const buckets = new Map(
    getLastMonthKeys(12).map((month) => [
      month,
      createTimelinePoint(month, formatMonth(month, language)),
    ] as const),
  );

  for (const request of requests) {
    const date = new Date(request.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const bucket = buckets.get(getMonthKey(date));
    if (bucket) addRequestToTimelinePoint(bucket, request);
  }

  return Array.from(buckets.values());
}

function buildTimelineData(
  requests: CivicRequest[],
  mode: TimelineMode,
  range: DateRange,
  language: string,
  t: TranslationFn,
): { granularity: TimelineGranularity; data: TimelinePoint[] } {
  if (mode === "months") {
    return { granularity: "months", data: buildMonthlyTimelineData(requests, language) };
  }

  if (getDateRangeDayCount(range) <= 1) {
    return { granularity: "hours", data: buildHourlyTimelineData(requests) };
  }

  return { granularity: "weekdays", data: buildWeekdayTimelineData(requests, t) };
}

function getTimelineTitle(granularity: TimelineGranularity, t: TranslationFn) {
  if (granularity === "hours") return t("map.analytics.timelineHours");
  if (granularity === "weekdays") return t("map.analytics.timelineWeekdays");
  return t("map.analytics.timelineMonths");
}

function getTimelineTotals(data: TimelinePoint[]) {
  return data.reduce(
    (total, item) => ({
      all: total.all + item.all,
      pending: total.pending + item.pending,
      closed: total.closed + item.closed,
    }),
    { all: 0, pending: 0, closed: 0 },
  );
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
  return request.priority === priority;
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
  const [timelineMode, setTimelineMode] = useState<TimelineMode>("period");
  const mapShellRef = useRef<HTMLElement | null>(null);

  const mode = (searchParams.get("mode") as MapMode | null) ?? "all";
  const category = searchParams.get("category") ?? "all";
  const status = (searchParams.get("status") as StatusFilter | null) ?? "all";
  const priority = (searchParams.get("priority") as PriorityFilter | null) ?? "all";
  const dateRange = useMemo(
    () => normalizeDateRange(searchParams.get("from"), searchParams.get("to")),
    [searchParams],
  );
  const dateBounds = useMemo(() => getDateRangeBounds(dateRange), [dateRange.from, dateRange.to]);
  const allMonthsBounds = useMemo(() => getAllMonthsBounds(), []);

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
    queryKey: [...queryKeys.publicRequests, "map", i18n.language, dateBounds.dateFrom, dateBounds.dateTo],
    queryFn: () => platformApi.getMapRequests(dateBounds),
  });
  const allMonthsRequestsQuery = useQuery({
    queryKey: [...queryKeys.publicRequests, "map", "timeline-months", i18n.language, allMonthsBounds.dateFrom, allMonthsBounds.dateTo],
    queryFn: () => platformApi.getMapRequests(allMonthsBounds),
  });

  const allRequests = useMemo(
    () => (publicRequestsQuery.data ?? []).filter((request) => getDateRangeMatch(request, dateRange)),
    [dateRange.from, dateRange.to, publicRequestsQuery.data],
  );

  const filteredRequests = useMemo(() => {
    return allRequests.filter((request) => {
      const matchesMode = mapMode !== "my" || request.citizenId === currentUser?.id;
      const matchesCategory = category === "all" || request.categoryId === category;
      const matchesStatus = status === "all" || request.status === status;
      const matchesPriority = getPriorityMatch(request, priority);
      return matchesMode && matchesCategory && matchesStatus && matchesPriority;
    });
  }, [allRequests, category, currentUser?.id, mapMode, priority, status]);

  const analyticsRequests = useMemo(
    () => (mapMode === "my" && currentUser
      ? allRequests.filter((request) => request.citizenId === currentUser.id)
      : allRequests),
    [allRequests, currentUser, mapMode],
  );

  const isLoading = publicRequestsQuery.isLoading;
  const [filtersVisible, setFiltersVisible] = useState(true);
  const hasActiveFilters = mapMode !== "all" || category !== "all" || status !== "all" || priority !== "all" || !isDefaultDateRange(dateRange);

  const statusCounts = useMemo(
    () => ({
      pending: getStatusCount(analyticsRequests, "pending"),
      inProgress: getStatusCount(analyticsRequests, "in_progress"),
      closed: getStatusCount(analyticsRequests, "closed"),
    }),
    [analyticsRequests],
  );

  const categoryData = useMemo(() => {
    const counts = new Map<string, { id: string; fallbackName: string; count: number }>();

    for (const request of analyticsRequests) {
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
  }, [analyticsRequests]);

  const timelineMonthRequests = useMemo(() => {
    return (allMonthsRequestsQuery.data ?? []).filter((request) => {
      const matchesMode = mapMode !== "my" || request.citizenId === currentUser?.id;
      const matchesCategory = category === "all" || request.categoryId === category;
      const matchesStatus = status === "all" || request.status === status;
      const matchesPriority = getPriorityMatch(request, priority);
      return matchesMode && matchesCategory && matchesStatus && matchesPriority;
    });
  }, [allMonthsRequestsQuery.data, category, currentUser?.id, mapMode, priority, status]);

  const timelineSourceRequests = timelineMode === "months" ? timelineMonthRequests : filteredRequests;
  const timeline = useMemo(
    () => buildTimelineData(timelineSourceRequests, timelineMode, dateRange, i18n.language, t),
    [dateRange.from, dateRange.to, i18n.language, t, timelineMode, timelineSourceRequests],
  );
  const timelineData = timeline.data;
  const timelineTitle = getTimelineTitle(timeline.granularity, t);
  const timelineTotals = useMemo(() => getTimelineTotals(timelineData), [timelineData]);

  const hotspots = useMemo<Hotspot[]>(() => {
    const groups = new Map<string, Hotspot>();

    for (const request of analyticsRequests) {
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
  }, [analyticsRequests]);

  const selectedHotspot = useMemo(
    () => hotspots.find((item) => item.address === selectedHotspotAddress) ?? null,
    [hotspots, selectedHotspotAddress],
  );
  const selectedRequest = selectedHotspot ? null : filteredRequests.find((request) => request.id === selectedId) ?? null;
  const mapRequests = selectedHotspot ? selectedHotspot.requests : filteredRequests;
  const activeMapMode: MapMode = selectedHotspot ? "all" : mapMode;

  const activityData = useMemo(() => {
    const matrix = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    for (const request of analyticsRequests) {
      const date = new Date(request.createdAt);
      if (Number.isNaN(date.getTime())) continue;
      const mondayFirstDay = (date.getDay() + 6) % 7;
      matrix[mondayFirstDay][date.getHours()] += 1;
    }
    const max = Math.max(...matrix.flat(), 1);
    return { matrix, max };
  }, [analyticsRequests]);

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

  function updateDateRange(nextRange: DateRange) {
    setSelectedHotspotAddress(null);
    const normalizedRange = normalizeDateRange(nextRange.from, nextRange.to);
    const next = new URLSearchParams(searchParams);
    if (isDefaultDateRange(normalizedRange)) {
      next.delete("from");
      next.delete("to");
    } else {
      next.set("from", normalizedRange.from);
      next.set("to", normalizedRange.to);
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
          <p>{t("map.subtitleWithCount", { count: analyticsRequests.length })}</p>
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
          <MapDateRangePicker
            range={dateRange}
            language={i18n.language}
            t={t}
            onChange={updateDateRange}
          />
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

          <AnalyticsCard
            title={timelineTitle}
            actions={(
              <div className="timeline-mode-toggle" role="group" aria-label={t("map.analytics.timelineView")}>
                {(["period", "months"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={timelineMode === item ? "is-active" : ""}
                    onClick={() => setTimelineMode(item)}
                  >
                    {item === "period" ? t("map.analytics.timelineSelectedPeriod") : t("map.analytics.timelineAllMonths")}
                  </button>
                ))}
              </div>
            )}
          >
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={timelineData}>
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis width={28} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip
                  formatter={(value, name) => [
                    formatRequestCount(Number(value), i18n.language),
                    getTimelineSeriesLabel(String(name), t),
                  ]}
                />
                <Bar name="all" dataKey="all" fill={TIMELINE_COLORS.all} radius={[8, 8, 0, 0]} />
                <Bar name="pending" dataKey="pending" fill={TIMELINE_COLORS.pending} radius={[8, 8, 0, 0]} />
                <Bar name="closed" dataKey="closed" fill={TIMELINE_COLORS.closed} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="timeline-summary">
              <span>{t("map.analytics.chartTotal")}: <b>{formatRequestCount(timelineTotals.all, i18n.language)}</b></span>
              <span>{localizeRequestStatus("pending", t)}: <b>{timelineTotals.pending}</b></span>
              <span>{localizeRequestStatus("closed", t)}: <b>{timelineTotals.closed}</b></span>
            </div>
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

function AnalyticsCard({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.article
      className="map-analytics__card"
      variants={{
        hidden: { opacity: 0, y: 18 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.28 } },
      }}
    >
      <div className="map-analytics__card-title">
        <div className="map-analytics__card-heading">
          <Activity size={18} />
          <h3>{title}</h3>
        </div>
        {actions}
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

function MapDateRangePicker({
  range,
  language,
  t,
  onChange,
}: {
  range: DateRange;
  language: string;
  t: TranslationFn;
  onChange: (range: DateRange) => void;
}) {
  const selectedEnd = parseDateKey(range.to) ?? new Date();
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(selectedEnd.getFullYear(), selectedEnd.getMonth(), 1));
  const [anchorKey, setAnchorKey] = useState<string | null>(null);
  const today = startOfLocalDay(new Date());
  const rangeStart = parseDateKey(range.from);
  const rangeEnd = parseDateKey(range.to);

  useEffect(() => {
    const end = parseDateKey(range.to);
    if (end) {
      setVisibleMonth(new Date(end.getFullYear(), end.getMonth(), 1));
    }
    if (anchorKey && range.from !== anchorKey && range.to !== anchorKey) {
      setAnchorKey(null);
    }
  }, [anchorKey, range.from, range.to]);

  const cells = useMemo(() => getCalendarCells(visibleMonth), [visibleMonth]);
  const canGoNext = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1) <= new Date(today.getFullYear(), today.getMonth(), 1);
  const weekdayLabels = useMemo(
    () => Array.from({ length: 7 }, (_, index) => formatWeekday(index, language)),
    [language],
  );

  function moveMonth(delta: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    setAnchorKey(null);
  }

  function selectDate(date: Date) {
    const selectedKey = toDateKey(date);
    const anchor = anchorKey ? parseDateKey(anchorKey) : null;

    if (!anchor) {
      setAnchorKey(selectedKey);
      onChange({ from: selectedKey, to: selectedKey });
      return;
    }

    let start = anchor < date ? anchor : date;
    let end = anchor < date ? date : anchor;
    if (diffCalendarDays(start, end) >= MAX_DATE_RANGE_DAYS) {
      if (date >= anchor) {
        end = addDays(start, MAX_DATE_RANGE_DAYS - 1);
      } else {
        start = addDays(end, -(MAX_DATE_RANGE_DAYS - 1));
      }
    }

    setAnchorKey(null);
    onChange({ from: toDateKey(start), to: toDateKey(end) });
  }

  return (
    <div className="map-page__calendar">
      <div className="map-page__calendar-header">
        <button type="button" onClick={() => moveMonth(-1)} aria-label={t("map.filters.previousMonth")}>
          ‹
        </button>
        <div>
          <strong>{formatDateRangeLabel(range, language)}</strong>
          <span>{formatCalendarMonth(visibleMonth, language)}</span>
        </div>
        <button type="button" onClick={() => moveMonth(1)} disabled={!canGoNext} aria-label={t("map.filters.nextMonth")}>
          ›
        </button>
      </div>
      <div className="map-page__calendar-help">{t("map.filters.dateRangeHelp")}</div>
      <div className="map-page__calendar-weekdays">
        {weekdayLabels.map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className="map-page__calendar-grid">
        {cells.map((cell) => {
          const cellDate = startOfLocalDay(cell.date);
          const isFuture = cellDate > today;
          const isStart = rangeStart ? cell.key === toDateKey(rangeStart) : false;
          const isEnd = rangeEnd ? cell.key === toDateKey(rangeEnd) : false;
          const isSelected = isStart || isEnd;
          const isInRange = Boolean(rangeStart && rangeEnd && cellDate > rangeStart && cellDate < rangeEnd);

          return (
            <button
              key={cell.key}
              type="button"
              className={[
                !cell.inMonth ? "is-muted" : "",
                isSelected ? "is-selected" : "",
                isStart ? "is-range-start" : "",
                isEnd ? "is-range-end" : "",
                isInRange ? "is-in-range" : "",
                anchorKey === cell.key ? "is-anchor" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => selectDate(cellDate)}
              disabled={isFuture}
            >
              {cellDate.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
